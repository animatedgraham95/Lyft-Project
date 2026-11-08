# Lyft Project
This project is to simulate matching drivers with pontential customers.
Assumptions: This program will always have an even number of customers and drivers. Drivers will always accept any ride.
First customer request a ride. The ride details include start A and end b. Then dispatch sends the request to the driver. Driver accepts ride then pick up customer. Then drops customer off.

Logic 
Client request ride
Dispatch calculates distance and sends information to the driver. Dispatch tries to pair both parties based on distance first then who is left for drivers
Driver accepts ride, once this happens the driver can not accept another ride and dispatch can not match the driver with another customer.
Driver drives to destination and tells dispatch that the ride is over.
Dispatch takes off the request.