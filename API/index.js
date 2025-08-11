const axios = require("axios");

module.exports = async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: "Missing query param `url`. Example: /?url=Hello+World"
      });
    }

    const KAIZ_APIKEY = "7eac9dce-b646-4ad1-8148-5b58eddaa2cc";
    const providerUrl = `https://kaiz-apis.gleeze.com/api/qrcode-generator?text=${encodeURIComponent(url)}&apikey=${KAIZ_APIKEY}`;

    const providerResp = await axios.get(providerUrl, {
      responseType: "arraybuffer",
      timeout: 20000
    });

    const ct = providerResp.headers?.["content-type"] || "";

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");

    if (ct.startsWith("image/")) {
      res.setHeader("Content-Type", ct);
      return res.status(200).send(Buffer.from(providerResp.data));
    }

    let parsed;
    try {
      parsed = JSON.parse(Buffer.from(providerResp.data).toString("utf8"));
    } catch {
      return res.status(502).json({
        success: false,
        message: "Provider returned unknown content",
        details: ct
      });
    }

    const imageUrl =
      parsed?.url ||
      parsed?.data?.url ||
      parsed?.image ||
      parsed?.img ||
      parsed?.result ||
      (typeof parsed === "string" && /^https?:\/\//.test(parsed) ? parsed : null);

    if (!imageUrl) {
      return res.status(502).json({
        success: false,
        message: "Provider returned JSON but no image URL could be found",
        raw: parsed
      });
    }

    const finalImg = await axios.get(imageUrl, {
      responseType: "arraybuffer",
      timeout: 20000
    });
    const finalCT = finalImg.headers?.["content-type"] || "image/png";

    res.setHeader("Content-Type", finalCT);
    return res.status(200).send(Buffer.from(finalImg.data));
  } catch (err) {
    console.error("API proxy error:", err.message || err);
    if (err.response?.data) {
      const bodyCt = err.response.headers?.["content-type"];
      if (bodyCt?.includes("application/json")) {
        try {
          return res
            .status(err.response.status || 502)
            .json(err.response.data);
        } catch {}
      }
    }
    return res.status(500).json({
      success: false,
      message: "Failed to fetch image",
      error: err.message
    });
  }
};
