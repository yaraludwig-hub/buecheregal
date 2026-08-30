const BookSearch = (() => {
  const SEARCH_URL = "https://www.googleapis.com/books/v1/volumes";

  async function searchBooks(query) {
    const cleanQuery = query.trim();

    if (!cleanQuery) {
      return [];
    }

    const url =
      `${SEARCH_URL}?q=${encodeURIComponent(cleanQuery)}&maxResults=20&printType=books`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Die Buchsuche konnte nicht geladen werden.");
    }

    const data = await response.json();

    if (!data.items) {
      return [];
    }

    return data.items.map(normalizeBook);
  }

  function normalizeBook(item) {
    const info = item.volumeInfo || {};
    const identifiers = info.industryIdentifiers || [];

    const isbn13 =
      identifiers.find(
        identifier => identifier.type === "ISBN_13"
      )?.identifier || "";

    const isbn10 =
      identifiers.find(
        identifier => identifier.type === "ISBN_10"
      )?.identifier || "";

    return {
      googleBooksId: item.id || "",

      title: info.title || "",

      subtitle: info.subtitle || "",

      author:
        Array.isArray(info.authors)
          ? info.authors.join(", ")
          : "",

      publisher: info.publisher || "",

      publishedDate: info.publishedDate || "",

      year: getYear(info.publishedDate),

      description: info.description || "",

      isbn13: isbn13,

      isbn10: isbn10,

      isbn: isbn13 || isbn10,

      pages:
        typeof info.pageCount === "number"
          ? info.pageCount
          : null,

      language: normalizeLanguage(info.language),

      categories:
        Array.isArray(info.categories)
          ? info.categories
          : [],

      genre:
        Array.isArray(info.categories) &&
        info.categories.length > 0
          ? info.categories[0]
          : "",

      cover:
        getBestCover(info.imageLinks),

      thumbnail:
        getThumbnail(info.imageLinks),

      previewLink: info.previewLink || "",

      infoLink: info.infoLink || ""
    };
  }

  function getYear(publishedDate) {
    if (!publishedDate) {
      return "";
    }

    const match = publishedDate.match(/\d{4}/);

    return match ? match[0] : "";
  }

  function normalizeLanguage(languageCode) {
    if (!languageCode) {
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

    return languages[languageCode] || languageCode;
  }

  function getBestCover(imageLinks) {
    if (!imageLinks) {
      return "";
    }

    const cover =
      imageLinks.extraLarge ||
      imageLinks.large ||
      imageLinks.medium ||
      imageLinks.small ||
      imageLinks.thumbnail ||
      imageLinks.smallThumbnail ||
      "";

    return improveImageUrl(cover);
  }

  function getThumbnail(imageLinks) {
    if (!imageLinks) {
      return "";
    }

    const thumbnail =
      imageLinks.thumbnail ||
      imageLinks.smallThumbnail ||
      "";

    return improveImageUrl(thumbnail);
  }

  function improveImageUrl(url) {
    if (!url) {
      return "";
    }

    return url
      .replace("http://", "https://")
      .replace("&edge=curl", "")
      .replace("zoom=1", "zoom=2");
  }

  return {
    searchBooks
  };
})();
