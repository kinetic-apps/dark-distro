API Description

Batch start cloud phones.

Request URL

https://openapi.geelark.com/open/v1/phone/start
Request Method

POST
Request Parameters

Parameter Name	Required	Type	Description	Example
ids	Yes	array[string]	List of cloud phone IDs	See request example
Request Example

{
    "ids":[
        "123456ABCDEF",
        "123456ABCDEF",
        "123456ABCDEF",
        "123456ABCDEF"
    ]
}
Response Example

{
 "code": 0,
 "msg": "success",
 "traceId": "12345678ABCDEF",
 "data": {
 "totalAmount": 3,
 "successAmount": 1,
 "failAmount": 2,
 "failDetails": [
 {
 "code": 43004,
 "id": "12345678ABCDEFG",
 "msg": "env is expired"
 },
 {
 "code": 42001,
 "id": "12345678ABCDEFG",
 "msg": "env not found"
 }
 ],
 "successDetails": [
 {
 "id": "12345678ABCDEFG",
 "url": "https://speedup.geelark.com/phone-api"
 }
 ]
 }
}
Response Data Description

Parameter Name	Type	Description
totalAmount	integer	Total number of requested IDs
successAmount	integer	Number of successful starts
successDetails	array[SuccessDetails]	Information about successed
failAmount	integer	Number of failed starts
failDetails	array[FailDetails]	Information about failures
SuccessDetails Successed Information

Parameter Name	Type	Description
id	string	ID of the cloud phone
url	string	remote url
FailDetails Failure Information

Parameter Name	Type	Description
code	integer	Failure code
id	string	ID of the failed cloud phone
msg	string	Failure message
Error Codes

Below are specific error codes for this interface. For other error codes, please refer to API Documentation.

Error Code	Description
42001	Cloud phone does not exist
43004	Cloud phone has expired
47004	Device associated with cloud phone does not exist
43007	Cloud phone is already in use by another user
45002	Cloud phone proxy is unavailable
47002	Cloud phone resources are insufficient
43020	Cloud phone is currently unavailable, please try again later