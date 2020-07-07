import polka from "polka";

polka()
  .all("/", (req, res) => {
    const data = {
      userAgent: (req.headers["user-agent"] ?? "").substring(0, 1000),
    };
    console.log(data);
    res.end("OK");
  })
  .listen(3333, (error) => {
    if (error) throw error;
    console.log(`> Running on localhost:3333`);
  });
