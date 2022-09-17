const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const databasePath = path.join(__dirname, "covid19IndiaPortal.db");

const initializeDbAndStartServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndStartServer();

const convertStateDbObjectToDbResponse = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDistrictDbObjectToDbResponse = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

//login user

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const getUserQuery = `
    SELECT
    *
    FROM
    user
    WHERE
    username = '${username}'`;
  const dbUser = await database.get(getUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      let payload = { username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_KEY");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// middleware  authentication

const authenticateUser = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwtToken = authHeader.split(" ")[1];
    jwt.verify(jwtToken, "MY_SECRET_KEY", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//list of all states

app.get("/states/", authenticateUser, async (request, response) => {
  const getStatesQuery = `
    SELECT
    *
    FROM
    state`;
  const statesArray = await database.all(getStatesQuery);
  response.send(
    statesArray.map((eachState) => convertStateDbObjectToDbResponse(eachState))
  );
});

//get state

app.get("/states/:stateId/", authenticateUser, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
    SELECT
    *
    FROM
    state
    WHERE
    state_id = '${stateId}'`;
  const stateArray = await database.get(getStateQuery);
  response.send(convertStateDbObjectToDbResponse(stateArray));
});

//create district

app.post("/districts/", authenticateUser, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createUserQuery = `
    INSERT INTO
    district(district_name,state_id,cases,cured,active,deaths)
    VALUES
    (
        '${districtName}',
        '${stateId}',
        '${cases}',
        '${cured}',
        '${active}',
        '${deaths}'
    )`;
  const newUser = await database.run(createUserQuery);
  response.send("District Successfully Added");
});

//get a district

app.get(
  "/districts/:districtId/",
  authenticateUser,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
    SELECT
    *
    FROM
    district
    WHERE
    district_id = '${districtId}'`;
    const districtArray = await database.get(getDistrictQuery);
    response.send(convertDistrictDbObjectToDbResponse(districtArray));
  }
);

///delete  district

app.delete(
  "/districts/:districtId/",
  authenticateUser,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteUserQuery = `
    DELETE FROM
    district
    WHERE
    district_id = '${districtId}'`;
    const deleteUser = await database.run(deleteUserQuery);
    response.send("District Removed");
  }
);

//update district

app.put(
  "/districts/:districtId/",
  authenticateUser,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateUserQuery = `
    UPDATE
    district
    SET
    district_name = '${districtName}',
    state_id = '${stateId}',
    cases = '${cases}',
    cured = '${cured}',
    deaths = '${deaths}'
    WHERE
    district_id = '${districtId}'`;
    const updateDetails = await database.run(updateUserQuery);
    response.send("District Details Updated");
  }
);

// state statistics

app.get(
  "/states/:stateId/stats/",
  authenticateUser,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatisticsQuery = `
    SELECT
    SUM(cases) AS totalCases,
    SUM(cured) AS totalCured,
    SUM(active) AS totalActive,
    SUM(deaths) AS totalDeaths
    FROM
    state
    NATURAL JOIN district
    WHERE
    state_id = '${stateId}';`;
    const statistics = await database.get(getStatisticsQuery);
    response.send(statistics);
  }
);

module.exports = app;
