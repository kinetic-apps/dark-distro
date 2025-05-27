Request URL

https://openapi.geelark.com/open/v1/rpa/task/tiktokLogin
Request Method

POST
Request Parameters

Parameter	Required	Type	Description
name	No	string	Task name, up to 32 characters
remark	No	string	Remarks, up to 200 characters
scheduleAt	Yes	int	Scheduled time (timestamp)
id	Yes	string	Cloud phone ID
account	Yes	string	Account, up to 64 characters
password	Yes	string	Password, up to 64 characters
Request Example

{
 "name":"test",
 "remark":"test remark",
 "scheduleAt": 1741846843,
 "id":"557536075321468390",
 "account":"test@gmail.com",
 "password": "123456"
}
Response Example

{
    "traceId": "A4D8BCF69B878A71AC589F5CB1D80EAB",
    "code": 0,
    "msg": "success",
    "data": {
        "taskId": "558017255909123564"
    }
}