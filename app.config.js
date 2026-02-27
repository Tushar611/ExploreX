const appJson = require("./app.json");

module.exports = () => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || "";

  const basePlugins = appJson.expo?.plugins || [];
  const plugins = basePlugins.includes("expo-asset") ? basePlugins : [...basePlugins, "expo-asset"];

  return {
    ...appJson,
    expo: {
      ...appJson.expo,
      plugins,
      android: {
        ...appJson.expo?.android,
        config: {
          ...(appJson.expo?.android?.config || {}),
          googleMaps: {
            apiKey: googleMapsApiKey,
          },
        },
      },
    },
  };
};
