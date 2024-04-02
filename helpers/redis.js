/*
const Redis = require('ioredis');
const bluebird = require('bluebird');
bluebird.promisifyAll(Redis);
console.log(process.env.REDISHOST);
// const client = redis.createClient();
const client = new Redis({
  port: 6379, // Redis port
  host: process.env.REDISHOST, // Redis host
  family: 4, // 4 (IPv4) or 6 (IPv6)
  password: process.env.REDISPASSWORD,
  db: 0,
  enableAutoPipelining: true,
});
// Print redis errors to the console
client.on('error', (err) => {
  console.log('Error ' + err);
});
client.on('connect', function () {
  console.log('You are now connected');
});
client.set('users', 'Ashish', 'EX', 0.5 * 60, (err) => {
  //cache for 10mins
  if (err) {
    console.log(err);
  }
  console.log('Inserted');
  //other operations will go here
  //probably respond back to the request
});
module.exports = client;
*/
