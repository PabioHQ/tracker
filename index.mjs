import polka from "polka";
import Dot from "dot-object";
import UAParser from "ua-parser-js";
import geolite2 from "geolite2-redist";
import anonymize from "ip-anonymize";
import maxmind from "maxmind";
import fs from "fs";
import dotenv from "dotenv";
import ElasticSearch from "@elastic/elasticsearch";
import AWS from "aws-sdk";
import parse from "url-parse";
import createAwsElasticsearchConnector from "aws-elasticsearch-connector";
dotenv.config();

const dot = new Dot("_");

const awsConfig = new AWS.Config({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});
const client = new ElasticSearch.Client({
  ...createAwsElasticsearchConnector(awsConfig),
  node: `https://${process.env.AWS_ELASTIC_HOST}`,
});

const lookup = geolite2.open("GeoLite2-City", (path) => {
  let lookupBuffer = fs.readFileSync(path);
  return new maxmind.Reader(lookupBuffer);
});

polka()
  .all("/", (req, res) => {
    // Get data from query and body
    const data = { ...req.query, date: new Date() };

    // Get user agent details
    const userAgent = (req.headers["user-agent"] || "").substring(0, 1000);
    const userAgentParser = new UAParser(userAgent);
    const userAgentResult = {
      string: userAgent,
      browser: userAgentParser.getBrowser(),
      cpu: userAgentParser.getCPU(),
      device: userAgentParser.getDevice(),
      engine: userAgentParser.getEngine(),
      os: userAgentParser.getOS(),
    };
    data.user_agent = userAgentResult;

    // Get geolocation details
    let ip =
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req.connection.socket ? req.connection.socket.remoteAddress : null);
    ip = (ip === "::1" ? "66.6.44.4" : ip) || "66.6.44.4";
    data.anonymous_ip = anonymize(ip);
    try {
      const locationValue = dot.dot(lookup.get(ip));
      Object.keys(locationValue).forEach((key) => {
        if (key.includes("_names_") && !key.includes("_names_en"))
          delete locationValue[key];
      });
      data.location = locationValue;
    } catch (error) {}

    // Update URLs
    Object.keys(saveObject).forEach((key) => {
      if (key.endsWith("_url")) {
        const fullUrl = saveObject[key] || "";
        if (fullUrl.startsWith("http")) {
          saveObject[key] = fullUrl.substring(0, 1000);
          data[`parsed_${key}`] = parse(fullUrl);
        }
      }
    });

    // Prepare object for saving
    const saveObject = JSON.parse(
      JSON.stringify(dot.dot(data)).replace(/\[/g, "_").replace(/\]/g, "")
    );
    Object.keys(saveObject).forEach(
      (key) =>
        (saveObject[key] === undefined || saveObject[key] === null) &&
        delete saveObject[key]
    );

    // Save record
    console.log(saveObject);
    // client
    //   .index({
    //     index: "analytics-website",
    //     body: saveObject,
    //   })
    //   .then(() => {})
    //   .catch((error) => console.log("ERROR", error));

    // Send OK response
    res.end("OK");
  })
  .listen(3333, (error) => {
    if (error) throw error;
    console.log(`> Running on localhost:3333`);
  });
