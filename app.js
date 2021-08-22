/*
    SETUP
*/
const express = require('express');
const app = express();
const port = 8487;

// Database
const db = require('./database/db-connector');

// Handlebars
const exphbs = require('express-handlebars');
app.engine('.hbs', exphbs({
  extname: ".hbs"
}));
app.set('view engine', '.hbs');

// JSON and form processing
app.use(express.json());
app.use(express.urlencoded({extended: true}));
 
// Crypto
const crypto = require('crypto');
const { resolve } = require('path');
const { group } = require('console');

/*
    Helpers
*/

// Citations for the following functions:
// Date: 08/09/2021
// Based on:
// Source URL: https://stackoverflow.com/a/36562248

// Gets formatted activities for activity select input.
async function getActivities() {
  const activitiesQuery = `
    SELECT
      a.activityId,
      a.name,
      a.startTime,
      l.latitude,
      l.longitude
    FROM
      \`activities\` a
    INNER JOIN \`locations\` l ON
      a.locationId = l.locationId;
  `;
  return new Promise((resolve, reject) => {
    db.pool.query(activitiesQuery, (err, activities, next) => {
      if (err) {
        reject(err);
      }
  
      // Format activities.
      resolve(activities.map((activity) => {
        let description = `${activity.name || 'Unnamed'} on ${activity.startTime.toDateString()} at ${activity.latitude}, ${activity.longitude}`;
        let id = activity.activityId;
        return {id, description}; 
      }));
    });
  });
}

// Gets formatted users for user select input.
async function getUsers() {
  return new Promise((resolve, reject) => {
    db.pool.query('SELECT userId, firstName, lastName FROM users', (err, users) => {
      if (err) {
        reject(err);
      }
  
      // Format users.
      resolve(users.map((user) => {
        let description = `# ${user.userId} -- ${user.firstName} ${user.lastName}`;
        return {id: user.userId, description};
      }));
    });
  });
}

// Get group details in case re-rendering is needed.
async function getGroupDetails(context, groupId) {
  const groupQuery = `
    SELECT
      u.firstName,
      u.lastName,
      u.userId,
      g.name,
      g.description,
      g.actionToTake,
      g.shareCode,
      g.activityId
    FROM
      groups g
    INNER JOIN members m ON
      g.groupId = m.groupId
    INNER JOIN users u ON
      m.userId = u.userId
    WHERE
      g.groupId = ? || g.shareCode = ?;
  `;
  return new Promise((resolve, reject) => {
    db.pool.query(groupQuery, [groupId, groupId], (err, groupMembers) => {
      if (err) {
        reject(err);
      }
  
      // Format members.
      context.members = groupMembers.map(groupMember => {
        return {firstName: groupMember.firstName, lastName: groupMember.lastName, id: groupMember.userId};
      });

      if (context.members.length < 1) {
        resolve(context);
        return;
      }
  
      // Format group details.
      const group = groupMembers[0];
      context.name = group.name || 'Unnamed';
      context.description = group.description || 'No description';
      context.actionToTake = group.actionToTake;
      context.shareCode = group.shareCode;
      context.activityId = group.activityId;
      context.groupId = groupId;
      context.oneMember = groupMembers.length === 1;

      if (context.activityId) {
      // added in order to display activities name on group details page -NR
      const activeName = "SELECT name as activityName FROM activities WHERE activityId = ?;";
      db.pool.query(activeName, [context.activityId], (err, rows, fields) => {
      if (err) {
        next(err);
        return;
      }
      context.activityName = rows[0].activityName;
      resolve(context);
      })}else{
        resolve(context);
      }
    });
  });
}

/*
    ROUTES
*/

// Home page.
app.get('/', (req, res) => {
  // Display user's groups
  res.redirect(`/users`);
});

// Create user form.
app.get('/users/new', (req, res) => {
  res.render('createUser', {});
});

// Citations for the following route:
// Date: 08/09/2021
// Based on:
// Source URLs: https://developer.mozilla.org/en-US/docs/Learn/Server-side/Express_Nodejs/forms
// and https://developer.mozilla.org/en-US/docs/Learn/Server-side/Express_Nodejs/forms

// Create user.
app.post('/users', (req, res, next) => {
  const user = req.body;
  // Validate required fields.
  if (user.firstName === '' || user.lastName === '' || user.phone === '') {
    
    // Set validation text.
    if (user.firstName === '') {
      user.invalid = 'First name is required.';
    } else if (user.lastName === '') {
      user.invalid = 'Last name is required.';
    } else {
      user.invalid = 'Phone number is required.';
    }

    res.status(400).render('createUser', user);
    return;
  }
  
  db.pool.query("INSERT INTO users (`firstName`, `lastName`, `phone`, `email`) VALUES (?, ?, ?, ?)",
  [user.firstName, user.lastName, user.phone, user.email || null],
  (err, result) => {
    if (err) {
      next(err);
      return;
    }

    res.redirect(`/users`);
  });
});

// List user's groups.
app.get('/users/:id/groups', (req, res, next) => {
  const context = {};

  const userGroupsQuery = `
    SELECT
      u.firstName,
      g.groupId,
      g.name,
      g.description
    FROM
      \`users\` u
    INNER JOIN \`members\` m ON
      u.userId = m.userId
    INNER JOIN \`groups\` g ON
      m.groupId = g.groupId
    WHERE
      u.userId = ?;
  `;
  // Get groups for a user.
  db.pool.query(userGroupsQuery, [req.params.id], (err, userGroups) => {
    if (err) {
      next(err);
      return;
    }

    // Provide defaults for description and name.
    context.groups = userGroups.map(userGroup => {
      userGroup['name'] = userGroup['name'] || 'Unnamed';
      userGroup['description'] = userGroup['description'] || 'No Description';
      return userGroup; 
    });

    if (userGroups.length < 1) {
      // Some users may not have any groups and won't appear in the original query.
      db.pool.query('SELECT firstName FROM `users` WHERE userId = ?', [req.params.id], (err, user) => {
        if (err) {
          next(err);
          return;
        }

        // Display 404 page if the user doesn't exist.
        if (user.length < 1) {
          res.render('404');
          return;
        }

        context.firstName = user[0].firstName;
        res.render('listUserGroups', context);
      });
    } else {
      context.firstName = userGroups[0].firstName;
      res.render('listUserGroups', context);
    }
  });
});

// List all users.
app.get('/users', (req, res) => {
  const usersQuery = `
    SELECT
      userId,
      firstName,
      lastName,
      phone,
      email
    FROM
      users;
  `;
  // Get all users.
  db.pool.query(usersQuery, (err, users, next) => {
    if (err) {
      next(err);
      return;
    }

    res.render('listUsers', {users});
  });
});

// Create group page. 
app.get('/groups/new', async (req, res) => {
  const context = {};

  try {
    context.activities = await getActivities();
    context.users = await getUsers();
  } catch(err) {
    next(err);
    return;
  }

  res.render('createGroup', context)  
});

// Citations for the following route:
// Date: 08/09/2021
// Based on:
// Source URL: https://github.com/mysqljs/mysql#transactions

app.post('/groups', async (req, res, next) => {
  const group = req.body;
  // Validate required fields.
  if (group.actionToTake === '' || group.userIds === undefined) {

    // Populate members and activities.
    try {
      group.activities = await getActivities();
      group.users = await getUsers();
    } catch(err) {
      next(err);
      return;
    }

    // Set validation text.
    if (group.actionToTake === '') {
      group.invalid = 'Action to take is required.';
    } else {
      group.invalid = 'At least one member is required.';
    }

    res.status(400).render('createGroup', group);
    return;
  }

  // Use transaction to insert Group and add Member.
  db.pool.getConnection((err, connection) => {
    connection.beginTransaction(err => {
      if (err) {
        next(err);
        return;
      }

      // Insert group; rollback if any errors occur.
      connection.query('INSERT INTO groups (`name`, `description`, `actionToTake`, `shareCode`, `activityId`) VALUES (?, ?, ?, ?, ?)',
      [group.name || null, group.description || null, group.actionToTake, crypto.randomBytes(18).toString('hex'), group.activityId || null],
      (err, result) => {
        if (err) {
          return connection.rollback(() => {
            next(err);
            return;
          });
        }

        // Insert member; rollback if any errors occur.
        let memberQuery = 'INSERT INTO members (`userId`, `groupId`, `accountedFor`) ';
        let escaped = [];
        if (!Array.isArray(group.userIds)) {
          memberQuery += 'VALUES (?, ?, ?)';
          group.userIds = [group.userIds];
          escaped.push(group.userIds[0], result.insertId.toString(), true);
        } else {
          group.userIds.forEach((member, index) => {
            if (index === 0) {
              memberQuery += 'VALUES (?, ?, ?)';
            } else {
              memberQuery += ', (?, ?, ?)';
            }

            escaped.push(member, result.insertId.toString(), true);
          })
        }
        memberQuery += ';';  // Terminate the query.
        connection.query(memberQuery, escaped, (err, result) => {
          if (err) {
            return connection.rollback(() => {
              next(err);
              return;
            });
          }

          // Commit successful changes.
          connection.commit((err) => {
            if (err) {
              return connection.rollback(() => {
                next(err);
                return;
              });
            }

            res.redirect(`/groups`);
          });
        });
      });
    });
  });
});

// Group details.
app.get('/groups/:id', async (req, res, next) => {
  const context = {};
  try {
    await getGroupDetails(context, req.params.id);
  } catch(err) {
    next(err);
    return;
  }

  if (context.members.length < 1) {
    res.render('404');
    return;
  }

  res.render('detailGroup', context);
});

// Update group form
app.get('/groups/:id/edit', (req, res, next) => {
  const context = {};
  const groupQuery = `
    SELECT
      u.userId,
      u.firstName,
      u.lastName,
      g.name,
      g.description,
      g.actionToTake,
      g.shareCode,
      g.activityId
    FROM
      groups g
    INNER JOIN members m ON
      g.groupId = m.groupId
    INNER JOIN users u ON
      m.userId = u.userId
    WHERE
      g.groupId = ? || g.shareCode = ?;
  `;
  // Get all users.
  db.pool.query(groupQuery, [req.params.id, req.params.id], async (err, groupMembers) => {
    if (err) {
      next(err);
      return;
    }

    if (groupMembers.length < 1) {
      res.render('404');
      return;
    }

    // Format group details.
    const group = groupMembers[0];
    context.name = group.name;
    context.description = group.description;
    context.actionToTake = group.actionToTake;
    context.activityId = group.activityId;
    context.groupId = req.params.id;

    try {
      context.activities = await getActivities()
      context.activities = context.activities.map((activity) => {
        let selected = context.activityId === activity.id;
        return {id: activity.id, description: activity.description, selected};
      });
    } catch(err) {
      next(err);
      return;
    }

    res.render('updateGroup', context);
  });
});

// Citations for the following route:
// Date: 08/09/2021
// Based on:
// Source URLs: https://canvas.oregonstate.edu/courses/1810872/pages/using-mysql-with-node-dot-js?module_item_id=20824535
// and https://developer.mozilla.org/en-US/docs/Learn/Server-side/Express_Nodejs/forms

// Update group.
app.post('/groups/:id', (req, res, next) => {
  const group = req.body;
  // Validate required fields.
  if (group.actionToTake === '') {
    group.invalid = 'Action to take is required.';

    res.status(400).render('createUser', group);
    return;
  }

  // Update selected group.
  const groupUpdateQuery = `
    UPDATE
      \`groups\`
    SET
      \`name\` = ?,
      \`description\` = ?,
      \`actionToTake\` = ?,
      \`activityId\` = ?
    WHERE \`groupId\` = ? || shareCode = ?;
  `;
  db.pool.query(groupUpdateQuery,
  [req.body.name || null, req.body.description || null, req.body.actionToTake, req.body.activityId || null,
  req.params.id, req.params.id],
  (err, result) => {
    if (err) {
      next(err);
      return;
    }

    res.redirect(`/groups/${req.params.id}`);
  });
});

// List all groups.
app.get('/groups', (req, res) => {
  const groupsQuery = `
    SELECT
      groupId,
      name,
      description,
      actionToTake,
      shareCode,
      activityId
    FROM
      groups;
  `;
  // Get all users.
  db.pool.query(groupsQuery, (err, groups) => {
    if (err) {
      next(err);
      return;
    }

    res.render('listGroup', {groups});
  });
});

// Add member to a group.
app.post('/groups/:id/members', (req, res, next) => {
  // Search for User
  const userMemberQuery = `
  SELECT 
    u.userId, m.groupId
  FROM 
    \`users\` u
  LEFT JOIN \`members\` m ON
    u.userId = m.userId
  WHERE
    u.userId = ?;
  `;
  db.pool.query(userMemberQuery, [req.body.userId, req.params.id], async (err, user) => {
    const context = {};

    if (user.length < 1) {
      // Re-render group with validation message.
      try {
        await getGroupDetails(context, req.params.id);
      } catch(err) {
        next(err);
        return;
      }
      
      context.invalid = `Could not find user with ID ${req.body.userId}`;
      res.render(`detailGroup`, context);
      return;
    } else if (user.some(membership => {
      return membership.groupId === Number(req.params.id);
    })) {
      // User is in the group already; re-render.
      try {
        await getGroupDetails(context, req.params.id);
      } catch(err) {
        next(err);
        return;
      }

      context.invalid = `That user is already a member.`;
      res.render(`detailGroup`, context);
      return;
    }
    
    db.pool.query('INSERT INTO `members` (userId, groupId, accountedFor) VALUES (?, ?, ?)', 
    [user[0].userId, req.params.id, true],
    (err, result) => {
      if (err) {
        next(err);
        return;
      }

      res.redirect(`/groups/${req.params.id}`);
    });
  });
});

// Remove member from group.
app.post('/groups/:id/members/delete/:memberId',  (req, res, next) => {
  db.pool.query('DELETE FROM `members` WHERE userId = ? AND groupId = ?', 
  [req.params.memberId, req.params.id],
  (err, result) => {
    if (err) {
      next(err);
      return;
    }

    res.redirect(`/groups/${req.params.id}`);
  });
});


// get all locations
app.get('/locations', (req, res) => {
  const locationsQuery = 'SELECT locationId, name, address1, address2, city, state, zipCode, latitude, longitude FROM locations';
  // Get list of locations.
  const locations = {}
  db.pool.query(locationsQuery, (err, rows, fields) => {
    if (err) {
      next(err);
      return;
    }
    locations.list = rows
    res.render('locations', locations)
  });
});

// specific location details
app.get('/location/get/:Id', (req, res) => {

  const locationQuery = `SELECT locationId, name, address1, address2, city, state, zipCode, latitude, longitude 
  FROM locations
  WHERE locationId = ?`
  
  // query location details
  db.pool.query(locationQuery, [req.params.Id], (err, rows, fields) => {
    if (err) {
      next(err);
      return;
    }
    const result = {}
    result.locationId = 
    result.name = rows[0].name
    result.address1 = rows[0].address1
    result.address2 = rows[0].address2
    result.city = rows[0].city
    result.state = rows[0].state
    result.zipCode = rows[0].zipCode
    result.latitude = rows[0].latitude
    result.longitude = rows[0].longitude
    result.address = false
    if (result.address1 || result.address2){
      result.address = true
    } else
    console.log(result.address)
    res.render('location', result)
  });
});

// new location page
app.get('/location/new', (req, res) => {
    res.render('locationNew')
  });

// create new location
app.post('/location/create/new', (req, res) => {
  const location = req.body;
  const newLocation = 'INSERT INTO locations (`name`, `address1`, `address2`, `city`, `state`, `zipCode`, `latitude`, `longitude`) VALUES (?, ?, ?, ?, ?, ?, ?, ?);';
  // query to insert new locations
  db.pool.query(newLocation, [location.name, location.address1, location.address2, location.city, 
    location.state, location.zipCode, location.latitude, location.longitude], (err, rows, fields) => {
    if (err) {
      next(err);
      return;
    }
    res.redirect('/locations');
  });
});

// get all activities
app.get('/activities', (req, res) => {
  const activitiesQuery = `SELECT a.activityId, a.name, a.startTime, a.endTime, a.risk, l.name AS place  
  FROM activities AS a, locations AS l
  WHERE a.locationId = l.locationId`;
  // Get list of activities.
  const activities = {}
  db.pool.query(activitiesQuery, (err, rows, fields) => {
    if (err) {
      next(err);
      return;
    }
    for (let i = 0; i < rows.length; i++){
      let start = rows[i].startTime
      let end = rows[i].endTime
      let sTime = start.toTimeString()
      sTime = sTime.slice(0, 8)
      const sDate = start.toDateString()
      let eTime = end.toTimeString()
      eTime = eTime.slice(0, 8)
      const eDate = end.toDateString()
      rows[i].startTime = `${sDate} at ${sTime}`
      rows[i].endTime = `${eDate} at ${eTime}`
    }
    activities.list = rows
    res.render('activities', activities)
  });
});

// new activities page
app.get('/activity/new', (req, res) => {
  const table = {}
  const locationInfo = "SELECT locationId, name FROM locations";
  db.pool.query(locationInfo, (err, rows, fields) => {
    if (err) {
      next(err);
      return;
    }
    table.location = rows
    const userInfo = "SELECT userId, firstName, lastName FROM users";
    db.pool.query(userInfo, (err, rows, fields) => {
      if (err) {
        next(err);
        return;
      }
      table.user = rows
      res.render('activityNew', table)
    });
  });
});

// new activity
app.post('/activity/new', (req, res) => {
  const activity = req.body;
  const newActivity = 'INSERT INTO activities (`name`, `startTime`, `endTime`, `risk`, `locationId`) VALUES (?, ?, ?, ?, ?);';
  // query to insert new locations
  db.pool.query(newActivity, [activity.name, activity.startTime, activity.endTime, activity.risk, 
    activity.locationId], (err, rows, fields) => {
    if (err) {
      next(err);
      return;
    }
    else {
      // query to add the contact to the newly created activity
      const addContact = 'INSERT INTO contacts (`userId`, `activityId`) VALUES (?, ?)'
      db.pool.query(addContact, [req.body.userId, rows.insertId], (err, rows, fields) => {
        if (err) {
          next(err);
          return;
        }
        res.redirect('/activities');
      });
    }
  });
});

// activity update page
app.get('/activity/edit/:activityId', (req, res) => {
  const response = {};
  // Citation for the DATE_FORMAT function in SQL below:
  // Date August 7th, 2021
  // Copied from:
  //Source URL: https://stackoverflow.com/questions/33019745/how-to-place-mysql-datetime-results-into-html-input-with-type-datetime-local
  const activityQuery = `SELECT l.name AS location, l.locationId, a.name, DATE_FORMAT(a.startTime, '%Y-%m-%dT%H:%i') AS startTime, 
  DATE_FORMAT(a.endTime, '%Y-%m-%dT%H:%i') AS endTime, a.risk 
  FROM activities AS a 
  INNER JOIN locations AS l ON a.locationId = l.locationId 
  WHERE a.activityId = ?;`
  // query activity details
  db.pool.query(activityQuery, [req.params.activityId], (err, rows, fields) => {
    if (err) {
      next(err);
      return;
    }
    else{
      // adding location details to object
      response.activityId = req.params.activityId
      response.location = rows[0].location
      response.idLocation = rows[0].locationId
      response.name = rows[0].name
      response.startTime = rows[0].startTime
      response.endTime = rows[0].endTime
      response.risk = rows[0].risk

      // query contact details
    const contactQuery = `SELECT u.firstName, u.lastName, u.phone, u.userId
    FROM activities AS a
    INNER JOIN contacts AS c ON a.activityId = c.activityId
    INNER JOIN users as u ON u.userId = c.userId
    WHERE a.activityId = ?`
    db.pool.query(contactQuery, [req.params.activityId], (err, result, fields) => {
      if (err) {
        next(err);
        return;
    
    } 
    let long = true
    if (result.length <= 1){
        long = false
    } 
    for (let pack = 0; pack < result.length; pack++){
      result[pack].long = long
      result[pack].activityId = req.params.activityId
      
    }
      response.contact = result
      // query all location details
      const allQuery = `SELECT locationId, name FROM locations WHERE locationId <> ?;`
      db.pool.query(allQuery, [response.idLocation], (err, answer, fields) => {
        if (err) {
          next(err);
          return;
      }
      response.locationNew = answer
      const allUsers = `SELECT userId, firstName, lastName FROM users;`
      db.pool.query(allUsers, (err, all, fields) => {
        if (err) {
          next(err);
          return;
      }
      response.fullContact = all
      res.render('activityEdit', response)
        });
        });
      });
    }
  });
});

// update activity
app.post('/activity/update/:activityId', (req, res) => {
  const update = req.body;
  const activityUpdate = `UPDATE activities
  SET name = ?, startTime = ?, endTime = ?, risk = ?, locationId = ?
  WHERE activityId = ?`;
  // query to update activity
  db.pool.query(activityUpdate, [update.name, update.startTime, update.endTime, update.risk, 
    update.locationId, req.params.activityId], (err, rows, fields) => {
    if (err) {
      next(err);
      return;
    }
    res.redirect(`/activity/get/${req.params.activityId}`);
  });
});

// activity details
app.get('/activity/get/:activityId', (req, res) => {
  const response = {};
  const activityQuery = `SELECT l.name AS location, a.name, a.startTime, a.endTime, a.risk 
  FROM activities AS a 
  INNER JOIN locations AS l ON a.locationId = l.locationId 
  WHERE a.activityId = ?;`
  // query activity details
  db.pool.query(activityQuery, [req.params.activityId], (err, rows, fields) => {
    if (err) {
      next(err);
      return;
    }
    else{
      // adding location details to object
      response.activityId = req.params.activityId
      response.location = rows[0].location
      response.name = rows[0].name
      response.startTime = rows[0].startTime
      response.endTime = rows[0].endTime
      response.risk = rows[0].risk
      // query contact details
    const contactQuery = `SELECT u.firstName, u.lastName, u.phone
    FROM activities AS a
    INNER JOIN contacts AS c ON a.activityId = c.activityId
    INNER JOIN users as u ON u.userId = c.userId
    WHERE a.activityId = ?`
    db.pool.query(contactQuery, [req.params.activityId], (err, result, fields) => {
      if (err) {
        next(err);
        return;
    }
    response.contact = result
    res.render('activity', response)
      });
    }
  });
});

// add contact
app.post('/add/contact/:activityId', (req, res, next) => {
  const addContact = 'INSERT INTO contacts (`userId`, `activityId`) VALUES (?, ?)';
  // query to update activity
  db.pool.query(addContact, [req.body.userId, req.params.activityId], (err, rows, fields) => {
    if (err) {
      console.log(err)
      next(err);
      return;
    }
    res.redirect(`/activity/edit/${req.params.activityId}`);
  });
});

// delete contact
app.post('/delete/contact/:activityId', (req, res) => {
  const deleteContact = 'DELETE FROM contacts WHERE userId = ? AND activityId = ?;';
  // query to update activity
  db.pool.query(deleteContact, [req.body.userId, req.params.activityId], (err, rows, fields) => {
    if (err) {
      next(err);
      return;
    }
    res.redirect(`/activity/edit/${req.params.activityId}`);
  });
});

app.use((req,res) => {
  const status = res.status(404);
  if (!req.is('application/json')) {
    status.render('404');
  } else {
    status.json({error: 'Could not find resource.'});
  }
});

app.use((err, req, res, next) => {
  const status = res.status(500);
  console.error(err.stack);
  if (!req.is('application/json')) {
    status.render('500')
  } else {
    status.json({error: 'Something went wrong.'});
  }
});

/*
  LISTENER
*/
app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
});
