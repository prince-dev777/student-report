const mongoose = require('mongoose');
const uri = 'mongodb://student_report:helloai.com@ac-hqw4l9b-shard-00-00.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-01.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-02.thx91mx.mongodb.net:27017/test?ssl=true&replicaSet=atlas-srcmx3-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0';
mongoose.connect(uri).then(async () => {
  const db = mongoose.connection.db;
  const results = await db.collection('testresults').find({}).sort({ _id: -1 }).limit(5).toArray();
  console.log(results.map(r => r.omrSheetImage));
  process.exit(0);
}).catch(console.error);
