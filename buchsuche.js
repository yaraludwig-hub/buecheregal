const BookSearch = (() => {

  const API_URL =
    "https://buecherregal-api.yara-ludwig.workers.dev";

  async function searchBooks(query) {

    const cleanQuery =
      query.trim();

    if (!cleanQuery) {
      return [];
    }

    const url =
      API_URL +
      "?q=" +
      encodeURIComponent(cleanQuery);

    const response =
      await fetch(url);

    if (!response.ok) {
      throw new Error(
        "Die Buchsuche konnte nicht geladen werden."
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
        getBestCover(
          info.imageLinks
        ),

      thumbnail:
        getThumbnail(
          info.imageLinks
        )

    };
  }


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


  function getBestCover(imageLinks) {

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

    return cleanImageUrl(url);
  }


  function getThumbnail(imageLinks) {

    if (!imageLinks) {
      return "";
    }

    const url =
      imageLinks.thumbnail ||
      imageLinks.smallThumbnail ||
      "";

    return cleanImageUrl(url);
  }


  function cleanImageUrl(url) {

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


  return {
    searchBooks
  };

})();
