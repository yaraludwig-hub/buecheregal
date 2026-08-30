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

      const googleUrl =
        "https://www.googleapis.com/books/v1/volumes" +
        "?q=" +
        encodeURIComponent(query.trim()) +
        "&maxResults=20" +
        "&printType=books";

      const googleResponse = await fetch(googleUrl);

      if (!googleResponse.ok) {
        throw new Error(
          "Google Books antwortete mit Status " +
          googleResponse.status
        );
      }

      const data = await googleResponse.json();

      return new Response(
        JSON.stringify(data),
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
