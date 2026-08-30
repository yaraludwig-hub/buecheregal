const BookSearch = (() => {

  async function searchBooks(query) {

    const cleanQuery = query.trim();

    if (!cleanQuery) {
      return [];
    }

    /*
      1. Zuerst versuchen wir Google Books.
      2. Falls Google nicht erreichbar ist oder keine Ergebnisse liefert,
         verwenden wir Open Library als Ersatz.
    */

    try {

      const googleResults =
        await searchGoogleBooks(cleanQuery);

      if (googleResults.length > 0) {
        return googleResults;
      }

    } catch (error) {

      console.warn(
        "Google Books konnte nicht geladen werden:",
        error
      );

    }


    try {

      const openLibraryResults =
        await searchOpenLibrary(cleanQuery);

      return openLibraryResults;

    } catch (error) {

      console.error(
        "Auch Open Library konnte nicht geladen werden:",
        error
      );

      throw new Error(
        "Keine Buchquelle konnte geladen werden."
      );

    }

  }



  /* -------------------------------------------------
     GOOGLE BOOKS
  ------------------------------------------------- */

  async function searchGoogleBooks(query) {

    const url =
      "https://www.googleapis.com/books/v1/volumes" +
      "?q=" +
      encodeURIComponent(query) +
      "&maxResults=20" +
      "&printType=books";


    const response =
      await fetch(url);


    if (!response.ok) {

      throw new Error(
        "Google Books HTTP " +
        response.status
      );

    }


    const data =
      await response.json();


    if (
      !data.items ||
      !Array.isArray(data.items)
    ) {

      return [];

    }


    return data.items.map(
      normalizeGoogleBook
    );

  }



  function normalizeGoogleBook(item) {

    const info =
      item.volumeInfo || {};


    const identifiers =
      info.industryIdentifiers || [];


    const isbn13 =
      identifiers.find(
        identifier =>
          identifier.type === "ISBN_13"
      )?.identifier || "";


    const isbn10 =
      identifiers.find(
        identifier =>
          identifier.type === "ISBN_10"
      )?.identifier || "";


    return {

      source:
        "Google Books",

      sourceId:
        item.id || "",

      title:
        info.title || "",

      subtitle:
        info.subtitle || "",

      author:
        Array.isArray(info.authors)
          ? info.authors.join(", ")
          : "",

      publisher:
        info.publisher || "",

      publishedDate:
        info.publishedDate || "",

      year:
        extractYear(
          info.publishedDate
        ),

      isbn13:
        isbn13,

      isbn10:
        isbn10,

      isbn:
        isbn13 || isbn10,

      pages:
        typeof info.pageCount === "number"
          ? info.pageCount
          : null,

      language:
        normalizeLanguage(
          info.language
        ),

      genre:
        Array.isArray(info.categories) &&
        info.categories.length > 0
          ? info.categories[0]
          : "",

      cover:
        getGoogleCover(
          info.imageLinks
        ),

      thumbnail:
        getGoogleThumbnail(
          info.imageLinks
        )

    };

  }



  function getGoogleCover(imageLinks) {

    if (!imageLinks) {
      return "";
    }


    const url =
      imageLinks.extraLarge ||
      imageLinks.large ||
      imageLinks.medium ||
      imageLinks.small ||
      imageLinks.thumbnail ||
      imageLinks.smallThumbnail ||
      "";


    return cleanGoogleImageUrl(
      url
    );

  }



  function getGoogleThumbnail(imageLinks) {

    if (!imageLinks) {
      return "";
    }


    const url =
      imageLinks.thumbnail ||
      imageLinks.smallThumbnail ||
      "";


    return cleanGoogleImageUrl(
      url
    );

  }



  function cleanGoogleImageUrl(url) {

    if (!url) {
      return "";
    }


    return url
      .replace(
        /^http:/,
        "https:"
      )
      .replace(
        "&edge=curl",
        ""
      );

  }



  /* -------------------------------------------------
     OPEN LIBRARY
  ------------------------------------------------- */

  async function searchOpenLibrary(query) {

    const url =
      "https://openlibrary.org/search.json" +
      "?q=" +
      encodeURIComponent(query) +
      "&limit=20";


    const response =
      await fetch(url);


    if (!response.ok) {

      throw new Error(
        "Open Library HTTP " +
        response.status
      );

    }


    const data =
      await response.json();


    if (
      !data.docs ||
      !Array.isArray(data.docs)
    ) {

      return [];

    }


    return data.docs.map(
      normalizeOpenLibraryBook
    );

  }



  function normalizeOpenLibraryBook(book) {

    const isbn =
      Array.isArray(book.isbn)
        ? chooseBestIsbn(book.isbn)
        : "";


    const coverId =
      book.cover_i || null;


    const cover =
      coverId
        ? "https://covers.openlibrary.org/b/id/" +
          coverId +
          "-L.jpg"
        : "";


    const thumbnail =
      coverId
        ? "https://covers.openlibrary.org/b/id/" +
          coverId +
          "-M.jpg"
        : "";


    const language =
      Array.isArray(book.language) &&
      book.language.length > 0
        ? normalizeOpenLibraryLanguage(
            book.language[0]
          )
        : "";


    const genre =
      Array.isArray(book.subject) &&
      book.subject.length > 0
        ? book.subject[0]
        : "";


    return {

      source:
        "Open Library",

      sourceId:
        book.key || "",

      title:
        book.title || "",

      subtitle:
        "",

      author:
        Array.isArray(
          book.author_name
        )
          ? book.author_name.join(", ")
          : "",

      publisher:
        Array.isArray(book.publisher) &&
        book.publisher.length > 0
          ? book.publisher[0]
          : "",

      publishedDate:
        book.first_publish_year
          ? String(
              book.first_publish_year
            )
          : "",

      year:
        book.first_publish_year || "",

      isbn13:
        isbn.length === 13
          ? isbn
          : "",

      isbn10:
        isbn.length === 10
          ? isbn
          : "",

      isbn:
        isbn,

      pages:
        typeof book.number_of_pages_median
          === "number"
          ? book.number_of_pages_median
          : null,

      language:
        language,

      genre:
        genre,

      cover:
        cover,

      thumbnail:
        thumbnail

    };

  }



  function chooseBestIsbn(isbns) {

    const isbn13 =
      isbns.find(
        isbn =>
          String(isbn).length === 13
      );


    if (isbn13) {
      return String(isbn13);
    }


    const isbn10 =
      isbns.find(
        isbn =>
          String(isbn).length === 10
      );


    if (isbn10) {
      return String(isbn10);
    }


    return isbns.length > 0
      ? String(isbns[0])
      : "";

  }



  /* -------------------------------------------------
     GEMEINSAME HILFSFUNKTIONEN
  ------------------------------------------------- */

  function extractYear(date) {

    if (!date) {
      return "";
    }


    const match =
      String(date).match(
        /\d{4}/
      );


    return match
      ? match[0]
      : "";

  }



  function normalizeLanguage(code) {

    if (!code) {
      return "";
    }


    const languages = {

      de: "Deutsch",
      en: "Englisch",
      fr: "Französisch",
      es: "Spanisch",
      it: "Italienisch",
      nl: "Niederländisch",
      pl: "Polnisch",
      pt: "Portugiesisch",
      sv: "Schwedisch",
      da: "Dänisch",
      no: "Norwegisch",
      fi: "Finnisch"

    };


    return languages[
      String(code).toLowerCase()
    ] || code;

  }



  function normalizeOpenLibraryLanguage(code) {

    if (!code) {
      return "";
    }


    const languages = {

      ger: "Deutsch",
      deu: "Deutsch",
      eng: "Englisch",
      fre: "Französisch",
      fra: "Französisch",
      spa: "Spanisch",
      ita: "Italienisch",
      dut: "Niederländisch",
      nld: "Niederländisch",
      pol: "Polnisch",
      por: "Portugiesisch",
      swe: "Schwedisch",
      dan: "Dänisch",
      nor: "Norwegisch",
      fin: "Finnisch"

    };


    return languages[
      String(code).toLowerCase()
    ] || "";

  }



  return {
    searchBooks
  };

})();
