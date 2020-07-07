import polka from "polka";

polka()
  .all("/", (req, res) => {
    console.log(req.body);
    res.end("OK");
  })
  .listen(3333, (error) => {
    if (error) throw error;
    console.log(`> Running on localhost:3333`);
  });
