const request = require("supertest");
const app = require("./index");

describe("Auth API", () => {
  test("register rejects invalid email", async () => {
    const response = await request(app)
      .post("/auth/register")
      .send({
        email: "hello",
        password: "12345678",
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Invalid email format",
    });
  });

  test("register rejects short password", async () => {
    const response = await request(app)
      .post("/auth/register")
      .send({
        email: "test@example.com",
        password: "123",
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Password must be at least 8 characters",
    });
  });

  test("login rejects wrong password", async () => {
    const response = await request(app)
      .post("/auth/login")
      .send({
        email: "test@example.com",
        password: "wrongpassword",
      });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "Invalid email or password",
    });
  });

  test("children endpoint requires authentication", async () => {
    const response = await request(app)
      .get("/children");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "Authorization token required",
    });
  });
});

describe("Validation API", () => {
  let token;

  beforeAll(async () => {
    const email = `test-${Date.now()}@example.com`;
    const password = "12345678";

    const registerResponse = await request(app)
      .post("/auth/register")
      .send({
        email,
        password,
      });

    token = registerResponse.body.token;
  });

  test("rejects invalid child gender", async () => {
    const response = await request(app)
      .post("/children")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Test Child",
        gender: "abc",
        birthDate: "2018-05-10",
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Gender must be male or female",
    });
  });

  test("rejects future birth date", async () => {
    const response = await request(app)
      .post("/children")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Test Child",
        gender: "male",
        birthDate: "2030-01-01",
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Birth date cannot be in the future",
    });
  });

  test("measurement endpoint requires authentication", async () => {
    const response = await request(app)
      .post("/children/some-id/measurements")
      .send({
        date: "2026-08-20",
        height: 120,
        weight: 24,
      });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "Authorization token required",
    });
  });

  test("rejects invalid height", async () => {
    const childResponse = await request(app)
      .post("/children")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Measurement Child",
        gender: "male",
        birthDate: "2018-05-10",
      });

    const childId = childResponse.body.id;

    const response = await request(app)
      .post(`/children/${childId}/measurements`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        date: "2026-08-20",
        height: -20,
        weight: 24,
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Height must be a valid number between 0 and 250 cm",
    });
  });
  test("rejects duplicate measurement for the same date", async () => {
  const childResponse = await request(app)
    .post("/children")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Duplicate Child",
      gender: "male",
      birthDate: "2018-05-10",
    });

  const childId = childResponse.body.id;

  const measurement = {
    date: "2026-08-20",
    height: 120,
    weight: 24,
  };

  const firstResponse = await request(app)
    .post(`/children/${childId}/measurements`)
    .set("Authorization", `Bearer ${token}`)
    .send(measurement);

  expect(firstResponse.status).toBe(201);

  const secondResponse = await request(app)
    .post(`/children/${childId}/measurements`)
    .set("Authorization", `Bearer ${token}`)
    .send(measurement);

  expect(secondResponse.status).toBe(409);

  expect(secondResponse.body).toEqual({
    error: "Measurement for this date already exists",
  });
});

test("user cannot access another user's child", async () => {
  const secondUserEmail = `second-${Date.now()}@example.com`;
  const password = "12345678";

  const secondUserResponse = await request(app)
    .post("/auth/register")
    .send({
      email: secondUserEmail,
      password,
    });

  const secondUserToken = secondUserResponse.body.token;

  const childResponse = await request(app)
    .post("/children")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Private Child",
      gender: "female",
      birthDate: "2019-03-10",
    });

  const childId = childResponse.body.id;

  const response = await request(app)
    .get(`/children/${childId}/measurements`)
    .set("Authorization", `Bearer ${secondUserToken}`);

  expect(response.status).toBe(404);

  expect(response.body).toEqual({
    error: "Child not found",
  });
});

});