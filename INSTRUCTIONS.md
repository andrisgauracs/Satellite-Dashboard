Please create a web dashboard that uses N2YO.com APIs, where we can track in realtime the positions of the international space station (ISS) - satid: 25544, and of specific Starlink satellites by sadid: [45074, 45048, 45044, 44961, 44933, 44768, 44748, 44744, 44736, 44723]

Use the sample design image provided here (`./preview.jpg`) as inspiration to create our dashboard. Display the basic parameters and available properties of every satellite.

Update the API every 4 seconds, but no faster, because we do not want to hit their rate limit. To comply with the API rates, for every 4 second update group all satellite requests together in one API call to prevent triggering a rate limit.

For the API requests please use the N2YO_API_KEY provided in the `./.env` file.

To understand N2YO.com APIs better, please refer to `./API.md` file

For additional API information, refer to https://www.n2yo.com/api/
