import polka from "polka";
import dot from "dot-object";
import UAParser from "ua-parser-js";

polka()
  .all("/", (req, res) => {
    const data = {};
    const userAgent = (req.headers["user-agent"] || "").substring(0, 1000);
    const userAgentParser = new UAParser(userAgent);
    const userAgentResult = {
      userAgent,
      browser: userAgentParser.getBrowser(),
      cpu: userAgentParser.getCPU(),
      device: userAgentParser.getDevice(),
      engine: userAgentParser.getEngine(),
      os: userAgentParser.getOS(),
    };
    data.userAgent = userAgentResult;
    const saveObject = dot.dot(data);
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
