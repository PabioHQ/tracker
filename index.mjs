import polka from "polka";
import Dot from "dot-object";
import UAParser from "ua-parser-js";
import geolite2 from "geolite2-redist";
import anonymize from "ip-anonymize";
import maxmind from "maxmind";
import fs from "fs";
import ES from "@elastic/elasticsearch";
import dotenv from "dotenv";
dotenv.config();

const dot = new Dot("_");

const lookup = geolite2.open("GeoLite2-City", (path) => {
  let lookupBuffer = fs.readFileSync(path);
  return new maxmind.Reader(lookupBuffer);
});

const elastic = new ES.Client({
  node: process.env.AWS_ELASTIC_HOST,
});

polka()
  .all("/", (req, res) => {
    const data = { ...req.query };
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
    const saveObject = JSON.parse(
      JSON.stringify(dot.dot(data)).replace(/\[/g, "_").replace(/\]/g, "")
    );
    Object.keys(saveObject).forEach(
      (key) =>
        (saveObject[key] === undefined || saveObject[key] === null) &&
        delete saveObject[key]
    );
    console.log(saveObject);
    res.end("OK");
  })
  .listen(3333, (error) => {
    if (error) throw error;
    console.log(`> Running on localhost:3333`);
  });
