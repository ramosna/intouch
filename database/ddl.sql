--sample data to populate the database

-- Dropping tables if they exist
DROP TABLE IF EXISTS contacts;
DROP TABLE IF EXISTS members;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS groups;
DROP TABLE IF EXISTS activities;
DROP TABLE IF EXISTS locations;

-- Creating the user tables
CREATE TABLE `users` (
`userId` int(11) NOT NULL AUTO_INCREMENT,
`firstName` varchar(255) NOT NULL,
`lastName` varchar(255) NOT NULL,
`phone` varchar(15) NOT NULL,
`email` varchar(255),
PRIMARY KEY (`userId`)
);

-- Creating the locations table
CREATE TABLE `locations` (
`locationId` int(11) NOT NULL AUTO_INCREMENT,
`name` varchar(255) NOT NULL,
`address1` varchar(255),
`address2` varchar(255),
`city` varchar(255),
`state` varchar(255),
`zipCode` varchar(255),
`latitude` DECIMAL(8, 6) NOT NULL,
`longitude` DECIMAL(9, 6) NOT NULL,
PRIMARY KEY (`locationId`)
);

-- Creating the activities table
CREATE TABLE `activities` (
`activityId` int(11) NOT NULL AUTO_INCREMENT,
`name` varchar(255),
`startTime` DATETIME NOT NULL,
`endTime` DATETIME NOT NULL,
`risk` int(11) NOT NULL,
`locationId` int(11) NOT NULL,
PRIMARY KEY (`activityId`),
FOREIGN KEY (`locationId`) REFERENCES `locations` (`locationid`)
);

-- creating the contacts table
CREATE TABLE `contacts` (
`userId` int(11),
`activityId` int(11),
PRIMARY KEY (`userId`, `activityId`),
FOREIGN KEY (`userId`) REFERENCES `users` (`userId`),
FOREIGN KEY (`activityId`) REFERENCES `activities` (`activityId`)
);

-- creating the groups table
CREATE TABLE `groups` (
`groupId` int(11) NOT NULL AUTO_INCREMENT,
`name` varchar(255),
`description` text,
`actionToTake` text NOT NULL,
`shareCode` char(36) NOT NULL UNIQUE,
`activityId` int(11),
PRIMARY KEY (`groupId`),
FOREIGN KEY (`activityId`) REFERENCES `activities` (`activityId`)
);

-- creating the members table
CREATE TABLE `members` (
`userId` int(11),
`groupId` int(11),
`accountedFor` boolean,
PRIMARY KEY (`userId`, `groupId`),
FOREIGN KEY (`userId`) REFERENCES `users` (`userId`),
FOREIGN KEY (`groupId`) REFERENCES `groups` (`groupId`)
);

-- inserting sample data into the users table
INSERT INTO `users` (`firstName`, `lastName`, `phone`, `email`) 
VALUES ('John', 'Doe', '6055558343', 'jdoe@gmail.com'),
('Tony', 'Hawk', '8745552286', NULL),
('Turanga', 'Leela', '4985550123', 'leela@planetexpress.com');

-- inserting sample data into the location table
INSERT INTO locations (`name`, `address1`, `address2`, `city`, `state`, `zipCode`, `latitude`, `longitude`)
VALUES (
'Yosemite National Park', 
'9035 Village Dr.',
NULL,
'Yosemite Valley',
'CA',
'95389',
'37.8651',
'119.5383'), (
'Lake Tahoe', 
NULL,
NULL,
NULL,
NULL,
NULL,
'39.0968',
'120.0324'), (
'DownTown Seattle', 
NULL,
NULL,
NULL,
NULL,
NULL,
'47.6050',
'122.3344');

-- inserting sample data into the activities table
INSERT INTO activities (`name`, `startTime`, `endTime`, `risk`, `locationId`)
VALUES (
'Outdoor Rock Climbing',
'2021-08-15 10:30:00',
'2021-08-15 14:30:00',
'8',
'1'), (
'Lake Tahoe Back Country Skiing',
'2021-08-20 08:00:00',
'2021-08-20 12:30:00',
'9',
'2'), ( 
'Exploring Downtown Seattle',
'2021-08-17 17:30:00',
'2021-08-18 1:30:00',
'2',
'3'
);

-- inserting sample data into contacts 
INSERT INTO contacts (`userId`, `activityId`)
VALUES (1, 1),
(2, 2),
(3, 2),
(3, 3);

-- inserting sample data into groups table
INSERT INTO `groups` (`name`, `description`, `actionToTake`, `shareCode`, `activityId`) 
VALUES (
'Rock Climbing', 
'Outdoor rock climbing group that takes place on the third Sunday of every month.',
"Check in an hour after the end time if we don't check in with you. If we don't answer immediately, get in touch with the park staff.",
'e1a059b4-a5fb-47f7-a1d8-307db8ddc70c',
1
), (
'Backcountry Skiing', 
'Backcountry skiing group in the Tahoe area.',
'Contact ski patrol if not back an hour after the lifts close.',
'2fbd2827-9015-4202-9a12-b3bdf8bf903e',
2
), (
'Solo Night Out', 
'For exploring downtown on my own.',
'Check in with me the next morning.',
'fbce5ddf-4714-416a-ad2f-f00c35f04147',
3
);

-- inserting sample data into the members table
INSERT INTO members (`userId`, `groupId`, `accountedFor`)
VALUES (1, 1, TRUE),
(1, 2, TRUE),
(2, 2, TRUE),
(3, 3, TRUE);
