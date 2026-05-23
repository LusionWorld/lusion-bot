const axios = require('axios');
const { JsonDatabase } = require("wio.db");
const { token } = require('../../config.json');

const db = new JsonDatabase({ databasePath: "./config.json" });

module.exports = async (client) => {
  await client.application.fetch();

  const url = `https://discord.com/api/v10/applications/@me`;

  function getDesiredDescription() {
    const desc = db.get("description");
    return (typeof desc === "string" && desc.trim().length > 0) ? desc : "";
  }

  async function updateDescription() {
    const desiredDescription = getDesiredDescription();
    try {
      await axios.patch(url, { description: desiredDescription }, {
        headers: {
          Authorization: `Bot ${token}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
    }
  }

  async function checkDescription() {
    const desiredDescription = getDesiredDescription();
    try {
      const response = await axios.get(url, { headers: { Authorization: `Bot ${token}` } });
      if (response.data.description !== desiredDescription) {
        await updateDescription();
      }
    } catch (error) {
    }
  }

  await updateDescription();

  setInterval(checkDescription, 600000);
};