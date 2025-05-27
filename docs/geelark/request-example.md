const CryptoJS = require("crypto-js");

const url = "https://openapi.geelark.com/open/v1/phone/list"; // Example request URL

const appID = "your appID"; // Your appID
const apiKey = "your apiKey"; // Your apiKey

let timestamp = new Date().getTime().toString(); // Millisecond timestamp

// Generate UUID
var traceUUid = "yxxyxxxxyxyxxyxxyxxxyxxxyxxyxxyx".replace(
 /[xy]/g,
 function (c) {
 var r = (Math.random() * 16) | 0, // Randomly generate a number between 0 and 15
 v = c == "x" ? r : (r & 0x3) | 0x8; // If c is 'y', only take one of 8, 9, a, b
 return v.toString(16); // Convert the number to a hexadecimal string
 }
);

var traceId = traceUUid.toUpperCase();

// nonce is the first 6 characters of traceId
var nonce = traceId.substring(0, 6);

var sign = CryptoJS.SHA256(appID + traceId + timestamp + nonce + apiKey)
 .toString()
 .toUpperCase();

var data = {
 page: 1,
 pageSize: 10,
};

headers = {
 "Content-Type": "application/json",
 appId: appID,
 traceId: traceId,
 ts: timestamp,
 nonce: nonce,
 sign: sign,
};

console.log(headers);

fetch(url, {
 method: "POST",
 headers: {
 "Content-Type": "application/json",
 appId: appID,
 traceId: traceId,
 ts: timestamp,
 nonce: nonce,
 sign: sign,
 },
 body: JSON.stringify(data),
})
 .then((res) => res.json())
 .then((res) => {
 console.log(res);
 })
 .catch((err) => {
 console.error(err);
 });
