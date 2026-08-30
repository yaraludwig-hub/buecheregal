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

    try {
      const requestUrl = new URL(request.url);
      const query = requestUrl.searchParams.get("q");

      if (!query || !query.trim()) {
        return new Response(
          JSON.stringify({
            error: "Bitte einen Suchbegriff mit ?q= angeben."
          }),
          {
            status: 400,
            headers: corsHeaders
          }
        );
      }

      const cleanQuery = query.trim();

      // 1. Zuerst Google Books versuchen
      const googleUrl =
        "https://www.googleapis.com/books/v1/volumes" +
        "?q=" +
        encodeURIComponent(cleanQuery) +
        "&maxResults=20" +
        "&printType=books";

      const googleResponse = await fetch(googleUrl);

      if (googleResponse.ok) {
        const googleData = await googleResponse.json();

        return new Response(
          JSON.stringify(googleData),
          {
            status: 200,
            headers: corsHeaders
          }
        );
      }

      // 2. Falls Google blockiert: Open Library
      const openLibraryUrl =
        "https://openlibrary.org/search.json" +
        "?q=" +
        encodeURIComponent(cleanQuery) +
        "&limit=12";

      const openLibraryResponse =
        await fetch(openLibraryUrl);

      if (!openLibraryResponse.ok) {
        throw new Error(
          "Open Library konnte nicht geladen werden."
        );
      }

      const openLibraryData =
        await openLibraryResponse.json();

      const docs =
        Array.isArray(openLibraryData.docs)
          ? openLibraryData.docs
          : [];

      const items = await Promise.all(
        docs.map(async (book, index) => {
          let editionData = null;

          // Wenn möglich konkrete Edition nachladen
          if (
            Array.isArray(book.edition_key) &&
            book.edition_key.length > 0
          ) {
            const editionKey =
              book.edition_key[0];

            try {
              const editionResponse =
                await fetch(
                  "https://openlibrary.org/books/" +
                  editionKey +
                  ".json"
                );

              if (editionResponse.ok) {
                editionData =
                  await editionResponse.json();
              }
            } catch {
              editionData = null;
            }
          }

          const searchIsbn =
            Array.isArray(book.isbn)
              ? book.isbn
              : [];

          const editionIsbn13 =
            editionData &&
            Array.isArray(editionData.isbn_13)
              ? editionData.isbn_13
              : [];

          const editionIsbn10 =
            editionData &&
            Array.isArray(editionData.isbn_10)
              ? editionData.isbn_10
              : [];

          const isbn13 =
            editionIsbn13[0] ||
            searchIsbn.find(
              value =>
                String(value).length === 13
            ) ||
            "";

          const isbn10 =
            editionIsbn10[0] ||
            searchIsbn.find(
              value =>
                String(value).length === 10
            ) ||
            "";

          const pages =
            editionData &&
            typeof editionData.number_of_pages === "number"
              ? editionData.number_of_pages
              : (
                  typeof book.number_of_pages_median === "number"
                    ? book.number_of_pages_median
                    : null
                );

          let coverId = null;

          if (
            editionData &&
            Array.isArray(editionData.covers) &&
            editionData.covers.length > 0
          ) {
            coverId =
              editionData.covers[0];
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

          let publishedDate = "";

          if (
            editionData &&
            editionData.publish_date
          ) {
            publishedDate =
              String(
                editionData.publish_date
              );
          } else if (
            book.first_publish_year
          ) {
            publishedDate =
              String(
                book.first_publish_year
              );
          }

          let language = "";

          if (
            editionData &&
            Array.isArray(editionData.languages) &&
            editionData.languages.length > 0 &&
            editionData.languages[0].key
          ) {
            language =
              editionData.languages[0].key
                .replace(
                  "/languages/",
                  ""
                );
          } else if (
            Array.isArray(book.language) &&
            book.language.length > 0
          ) {
            language =
              book.language[0];
          }

          const publisher =
            editionData &&
            Array.isArray(editionData.publishers) &&
            editionData.publishers.length > 0
              ? editionData.publishers[0]
              : (
                  Array.isArray(book.publisher)
                    ? book.publisher[0] || ""
                    : ""
                );

          return {
            id:
              (
                editionData &&
                editionData.key
              ) ||
              book.key ||
              "openlibrary-" + index,

            volumeInfo: {
              title:
                (
                  editionData &&
                  editionData.title
                ) ||
                book.title ||
                "",

              subtitle:
                (
                  editionData &&
                  editionData.subtitle
                ) ||
                "",

              authors:
                Array.isArray(book.author_name)
                  ? book.author_name
                  : [],

              publisher:
                publisher,

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
                  ? [{
                      type: "ISBN_13",
                      identifier: isbn13
                    }]
                  : []),

                ...(isbn10
                  ? [{
                      type: "ISBN_10",
                      identifier: isbn10
                    }]
                  : [])
              ],

              imageLinks:
                coverUrl
                  ? {
                      thumbnail: coverUrl,
                      smallThumbnail: coverUrl,
                      medium: coverUrl,
                      large: coverUrl
                    }
                  : {}
            }
          };
        })
      );

      return new Response(
        JSON.stringify({
          kind: "books#volumes",
          totalItems: items.length,
          items: items
        }),
        {
          status: 200,
          headers: corsHeaders
        }
      );

    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "Die Buchsuche konnte nicht geladen werden.",
          details: error.message
        }),
        {
          status: 500,
          headers: corsHeaders
        }
      );
    }
  }
};
