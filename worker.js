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

      // 2. Falls Google blockiert: Open Library verwenden
      const openLibraryUrl =
        "https://openlibrary.org/search.json" +
        "?q=" +
        encodeURIComponent(cleanQuery) +
        "&limit=20";

      const openLibraryResponse =
        await fetch(openLibraryUrl);

      if (!openLibraryResponse.ok) {
        throw new Error(
          "Auch Open Library konnte nicht geladen werden."
        );
      }

      const openLibraryData =
        await openLibraryResponse.json();

      const items =
        (openLibraryData.docs || []).map((book, index) => {

          const isbn =
            Array.isArray(book.isbn)
              ? book.isbn
              : [];

          const isbn13 =
            isbn.find(value =>
              String(value).length === 13
            ) || "";

          const isbn10 =
            isbn.find(value =>
              String(value).length === 10
            ) || "";

          let coverUrl = "";

          if (book.cover_i) {
            coverUrl =
              "https://covers.openlibrary.org/b/id/" +
              book.cover_i +
              "-L.jpg";
          }

          return {
            id:
              book.key ||
              "openlibrary-" + index,

            volumeInfo: {
              title:
                book.title || "",

              authors:
                Array.isArray(book.author_name)
                  ? book.author_name
                  : [],

              publisher:
                Array.isArray(book.publisher)
                  ? book.publisher[0] || ""
                  : "",

              publishedDate:
                book.first_publish_year
                  ? String(book.first_publish_year)
                  : "",

              pageCount:
                book.number_of_pages_median || null,

              language:
                Array.isArray(book.language)
                  ? book.language[0] || ""
                  : "",

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
        });

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
