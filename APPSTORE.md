# Swedish Weather Forecast

### This app adds support for Swedish Weather Data.

## Included devices/features:
* 0-36 hours of Weather Forecast based on Homey geolocation.
* 0-3 days of Pollen Level Forecast based on choosen Swedish city.

### Weather Forecast Data - in English
<a href="https://github.com/JohanBendz/se.swefa">
  <img src="https://raw.githubusercontent.com/JohanBendz/se.swefa/Beta/assets/images/WeatherForecastScreen.PNG">
</a>
<br>Settings: Select a point in time for forecasts  (hours/days ahead).

### Pollen Level Data - in Swedish only
<a href="https://github.com/JohanBendz/se.swefa">
  <img src="https://raw.githubusercontent.com/JohanBendz/se.swefa/Beta/assets/images/PollenLevelScreen.PNG">
</a>
<br>Settings: Select a city from the list to have 3 day Pollen Level forecast for that area. 

## Feedback:
* Please post requests in the [Swedish Weather Forecast](https://community.athom.com/t/swedish-weather-forecast/) topic on the Athom Community forum.
* Please report any problems concerning the code in the [issues section](https://github.com/JohanBendz/se.swefa/issues) on Github.

## Change Log:

### v 0.2.3
* Cosmetic update
### v 0.2.2
* Weather Forecast timeframe limited to 36 hours (working on fixing 8 days).
### v 0.2.1
* Minor fixes 
### v 0.2.0
* Beta release

## Known issues:
* When adding more than one Pollen device a restart of the app or Homey itself renders all Pollen devices to use the same source of data until settings are manually updated.

* When adding more than one Weather device a restart of the app or Homey itself renders all Weather devices to use the same source of data until settings are manually updated.
