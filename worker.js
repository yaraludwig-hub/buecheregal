export default {
  async fetch(request) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json; charset=UTF-8"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    if (request.method !== "GET") {
      return jsonResponse(
        {
          error: "Nur GET-Anfragen sind erlaubt."
        },
        405,
        corsHeaders
      );
    }

    try {
      const requestUrl = new URL(request.url);
      const query = requestUrl.searchParams.get("q");

      if (!query || !query.trim()) {
        return jsonResponse(
          {
            error: "Bitte einen Suchbegriff mit ?q= angeben."
          },
          400,
          corsHeaders
        );
      }

      const cleanQuery = query.trim();

      /*
        1. Werke bei Open Library suchen
      */

      const searchUrl =
        "https://openlibrary.org/search.json" +
        "?q=" +
        encodeURIComponent(cleanQuery) +
        "&limit=10";

      const searchResponse = await fetch(searchUrl, {
        headers: {
          "User-Agent": "Buecherregal-App/1.0"
        }
      });

      if (!searchResponse.ok) {
        throw new Error(
          "Open-Library-Suche antwortete mit Status " +
          searchResponse.status
        );
      }

      const searchData = await searchResponse.json();

      const docs = Array.isArray(searchData.docs)
        ? searchData.docs
        : [];

      if (docs.length === 0) {
        return jsonResponse(
          {
            kind: "books#volumes",
            totalItems: 0,
            items: []
          },
          200,
          corsHeaders
        );
      }

      /*
        2. Für die wichtigsten Treffer konkrete Editionen laden
      */

      const results = [];

      for (const book of docs.slice(0, 10)) {
        const workKey = book.key;

        let editions = [];

        if (
          typeof workKey === "string" &&
          workKey.startsWith("/works/")
        ) {
          try {
            const editionsUrl =
              "https://openlibrary.org" +
              workKey +
              "/editions.json?limit=30";

            const editionsResponse = await fetch(editionsUrl, {
              headers: {
                "User-Agent": "Buecherregal-App/1.0"
              }
            });

            if (editionsResponse.ok) {
              const editionsData =
                await editionsResponse.json();

              editions =
                Array.isArray(editionsData.entries)
                  ? editionsData.entries
                  : [];
            }
          } catch (error) {
            editions = [];
          }
        }

        /*
          3. Beste Edition auswählen

          Besonders wichtig:
          - ISBN
          - Seitenzahl
          - Cover
          - Sprache
          - Verlag
        */

        let bestEdition = null;
        let bestScore = -1;

        for (const edition of editions) {
          const score =
            scoreEdition(edition);

          if (score > bestScore) {
            bestScore = score;
            bestEdition = edition;
          }
        }

        const converted =
          convertToGoogleFormat(
            book,
            bestEdition,
            results.length
          );

        results.push(converted);
      }

      return jsonResponse(
        {
          kind: "books#volumes",
          totalItems: results.length,
          items: results
        },
        200,
        corsHeaders
      );

    } catch (error) {
      return jsonResponse(
        {
          error:
            "Die Buchsuche konnte nicht geladen werden.",
          details:
            error instanceof Error
              ? error.message
              : String(error)
        },
        500,
        corsHeaders
      );
    }
  }
};


/*
  Bewertet eine konkrete Buchausgabe.

  Je vollständiger die Ausgabe,
  desto höher die Punktzahl.
*/

function scoreEdition(edition) {
  let score = 0;

  if (
    Array.isArray(edition.isbn_13) &&
    edition.isbn_13.length > 0
  ) {
    score += 10;
  }

  if (
    Array.isArray(edition.isbn_10) &&
    edition.isbn_10.length > 0
  ) {
    score += 5;
  }

  if (
    typeof edition.number_of_pages === "number" &&
    edition.number_of_pages > 0
  ) {
    score += 10;
  }

  if (
    Array.isArray(edition.covers) &&
    edition.covers.length > 0
  ) {
    score += 8;
  }

  if (
    Array.isArray(edition.languages) &&
    edition.languages.length > 0
  ) {
    score += 3;
  }

  if (
    Array.isArray(edition.publishers) &&
    edition.publishers.length > 0
  ) {
    score += 2;
  }

  if (edition.publish_date) {
    score += 2;
  }

  return score;
}


/*
  Open-Library-Daten in dasselbe Format umwandeln,
  das unsere App bereits von Google Books erwartet.
*/

function convertToGoogleFormat(
  book,
  edition,
  index
) {
  const isbn13 =
    edition &&
    Array.isArray(edition.isbn_13)
      ? edition.isbn_13[0] || ""
      : findIsbn(book.isbn, 13);

  const isbn10 =
    edition &&
    Array.isArray(edition.isbn_10)
      ? edition.isbn_10[0] || ""
      : findIsbn(book.isbn, 10);


  /*
    Seitenzahl
  */

  let pages = null;

  if (
    edition &&
    typeof edition.number_of_pages === "number"
  ) {
    pages =
      edition.number_of_pages;
  } else if (
    typeof book.number_of_pages_median === "number"
  ) {
    pages =
      book.number_of_pages_median;
  }


  /*
    Sprache
  */

  let language = "";

  if (
    edition &&
    Array.isArray(edition.languages) &&
    edition.languages.length > 0
  ) {
    const languageEntry =
      edition.languages[0];

    if (
      languageEntry &&
      typeof languageEntry.key === "string"
    ) {
      language =
        languageEntry.key.replace(
          "/languages/",
          ""
        );
    }
  }

  if (
    !language &&
    Array.isArray(book.language) &&
    book.language.length > 0
  ) {
    language =
      book.language[0];
  }


  /*
    Cover
  */

  let coverId = null;

  if (
    edition &&
    Array.isArray(edition.covers) &&
    edition.covers.length > 0
  ) {
    coverId =
      edition.covers[0];
  } else if (book.cover_i) {
    coverId =
      book.cover_i;
  }

  const coverUrl =
    coverId
      ? "https://covers.openlibrary.org/b/id/" +
        coverId +
        "-L.jpg"
      : "";


  /*
    Erscheinungsdatum
  */

  let publishedDate = "";

  if (
    edition &&
    edition.publish_date
  ) {
    publishedDate =
      String(edition.publish_date);
  } else if (
    book.first_publish_year
  ) {
    publishedDate =
      String(book.first_publish_year);
  }


  /*
    Verlag
  */

  let publisher = "";

  if (
    edition &&
    Array.isArray(edition.publishers) &&
    edition.publishers.length > 0
  ) {
    publisher =
      edition.publishers[0];
  } else if (
    Array.isArray(book.publisher) &&
    book.publisher.length > 0
  ) {
    publisher =
      book.publisher[0];
  }


  /*
    Titel
  */

  const title =
    edition &&
    edition.title
      ? edition.title
      : book.title || "";


  /*
    Untertitel
  */

  const subtitle =
    edition &&
    edition.subtitle
      ? edition.subtitle
      : "";


  return {
    id:
      edition &&
      edition.key
        ? edition.key
        : book.key ||
          "openlibrary-" + index,

    volumeInfo: {
      title: title,

      subtitle: subtitle,

      authors:
        Array.isArray(book.author_name)
          ? book.author_name
          : [],

      publisher: publisher,

      publishedDate:
        publishedDate,

      pageCount:
        pages,

      language:
        language,

      categories:
        Array.isArray(book.subject)
          ? book.subject.slice(0, 1)
          : [],

      industryIdentifiers: [
        ...(isbn13
          ? [
              {
                type: "ISBN_13",
                identifier: isbn13
              }
            ]
          : []),

        ...(isbn10
          ? [
              {
                type: "ISBN_10",
                identifier: isbn10
              }
            ]
          : [])
      ],

      imageLinks:
        coverUrl
          ? {
              smallThumbnail:
                coverUrl,

              thumbnail:
                coverUrl,

              small:
                coverUrl,

              medium:
                coverUrl,

              large:
                coverUrl,

              extraLarge:
                coverUrl
            }
          : {}
    }
  };
}


/*
  ISBN aus dem normalen Suchergebnis holen,
  falls die Edition keine enthält.
*/

function findIsbn(isbns, length) {
  if (!Array.isArray(isbns)) {
    return "";
  }

  const result =
    isbns.find(value => {
      const cleaned =
        String(value).replace(
          /[^0-9X]/gi,
          ""
        );

      return cleaned.length === length;
    });

  return result || "";
}


/*
  Einheitliche JSON-Antwort
*/

function jsonResponse(
  data,
  status,
  headers
) {
  return new Response(
    JSON.stringify(data),
    {
      status: status,
      headers: headers
    }
  );
}
