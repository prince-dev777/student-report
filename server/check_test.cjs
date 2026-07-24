const mongoose = require("mongoose");
mongoose.connect("mongodb://127.0.0.1:27017/student-report").then(async () => {
  const tests = mongoose.connection.db.collection("tests");
  const latest = await tests.find().sort({createdAt: -1}).limit(1).toArray();
  console.log(JSON.stringify(latest, null, 2));
  process.exit(0);
});
