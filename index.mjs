import polka from "polka";
import Dot from "dot-object";
import UAParser from "ua-parser-js";
import geolite2 from "geolite2-redist";
import anonymize from "ip-anonymize";
import maxmind from "maxmind";
import fs from "fs";
import dotenv from "dotenv";
import AWS from "aws-sdk";
dotenv.config();

const dot = new Dot("_");

const lookup = geolite2.open("GeoLite2-City", (path) => {
  let lookupBuffer = fs.readFileSync(path);
  return new maxmind.Reader(lookupBuffer);
});

polka()
  .all("/", (req, res) => {
    // Get data from query and body
    const data = { ...req.query };

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

    // Prepare object for saving
    const saveObject = JSON.parse(
      JSON.stringify(dot.dot(data)).replace(/\[/g, "_").replace(/\]/g, "")
    );
    Object.keys(saveObject).forEach(
      (key) =>
        (saveObject[key] === undefined || saveObject[key] === null) &&
        delete saveObject[key]
    );

    // console.log(saveObject);
    // Save record
    const endpoint = new AWS.Endpoint(
      `https://${process.env.AWS_ELASTIC_HOST}`
    );
    const request = new AWS.HttpRequest(endpoint, process.env.AWS_REGION);
    request.method = "POST";
    request.path += "analytics/_doc/1";
    request.body = JSON.stringify(saveObject);
    request.headers.host = process.env.AWS_ELASTIC_HOST;
    request.headers["Content-Type"] = "application/json";
    request.headers["Content-Length"] = Buffer.byteLength(request.body);
    const credentials = new AWS.EnvironmentCredentials("AWS");
    const signer = new AWS.Signers.V4(request, "es");
    signer.addAuthorization(credentials, new Date());

    const client = new AWS.HttpClient();
    client.handleRequest(
      request,
      null,
      (response) => {
        console.log(response.statusCode + " " + response.statusMessage);
        let responseBody = "";
        response.on("data", (chunk) => {
          responseBody += chunk;
        });
        response.on("end", () => {
          console.log("Response body: " + responseBody);
        });
      },
      (error) => {
        console.log("Error: " + error);
      }
    );

    // Send OK response
    res.end("OK");
  })
  .listen(3333, (error) => {
    if (error) throw error;
    console.log(`> Running on localhost:3333`);
  });
