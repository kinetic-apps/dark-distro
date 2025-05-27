API Description

Install an app.

Request URL

https://openapi.geelark.com/open/v1/app/install
Request Method

POST
Request Parameters

Parameter Name	Required	Type	Description	Example
envId	Yes	string	Cloud phone environment ID	1809135651036667904
appVersionId	Yes	string	App version ID	1793552962140770305
Request Example

{
 "envId" : "1809135651036667904",
 "appVersionId" : "1793552962140770305"
}
Response Example

{
 "traceId": "123",
 "code": 0,
 "msg": "success"
}
Error Codes

The following are specific error codes for this interface. For other error codes, please refer to the API Call Documentation.

Error Code	Description
42001	The specified cloud phone does not exist
42002	The cloud phone is not in running state
42003	The app is currently being installed
42004	A higher version of the app is already installed, installing a lower version is not allowed
42006	app not exist