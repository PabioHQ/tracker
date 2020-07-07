import polka from "polka";

polka()
  .get("/", (req, res) => {
    res.send("OK");
  })
  .listen(3333, (error: any) => {
    if (error) throw error;
    console.log(`> Running on localhost:3333`);
  });
