# SMHI Fire Risk driver

This branch adds a separate Homey device for SMHI's daily fire-risk forecasts.

## Data source

The driver uses SMHI's open daily fire-risk forecast API:

`https://opendata-download-metfcst.smhi.se/api/category/fwif1g/version/1/daily/geotype/point/lon/{lon}/lat/{lat}/data.json`

SMHI documents daily forecasts for six days. The daily forest-fire-risk value represents the afternoon, when fire risk is often highest. The daily grass-fire-risk value represents the highest grass-fire risk during the day.

## Models exposed

The device intentionally keeps SMHI's three concepts separate:

- **Forest fire risk** — FWI-based spread/fire-behaviour class.
- **Grass fire risk** — risk for old dry grass, including snow-covered ground and season-over states.
- **Forest fuel dryness** — drying of forest fuels and deeper layers relevant to persistent fires.

Forest fire risk and forest fuel dryness use SMHI's 1–5E presentation. The API encodes the highest class as numeric 6; the device presents it as **5E**.

A value of `-1` is treated as **Data missing / off season**, never as low risk.

## Device settings

Each device can use Homey's location or custom latitude/longitude and can select:

- Today
- Tomorrow
- 2 days ahead
- 3 days ahead
- 4 days ahead
- 5 days ahead

This allows users to create separate Homey devices for different locations and/or forecast days without mixing the data with the normal weather forecast device.

## Update and freshness behaviour

The device checks once per hour. Point responses are cached by coordinate pair at app level for 30 minutes, so multiple fire-risk devices for the same location do not download the same payload repeatedly.

The API's `approvedTime` must be valid and no more than 24 hours old. A stale or failed source marks the device unavailable rather than presenting old data as a current fire-risk assessment.

## Flow cards

Triggers:

- Forest fire risk changes to ...
- Grass fire risk changes to ...
- Forest fuel dryness changes to ...

Conditions:

- Forest fire risk is at least ...
- Grass fire risk is at least ...
- Forest fuel dryness is at least ...

The grass-risk threshold condition only exposes actual risk classes (Low through Very high). Snow-covered ground and grass-fire-season-over remain display/trigger states rather than numeric risk thresholds.

## Important distinction

This device is a **forecast of fire risk**. It is not an official fire ban and must not be interpreted as one. Fire bans are issued by responsible local/regional authorities and can differ from the modelled fire-risk class.

## Sources

- SMHI: https://www.smhi.se/data/temperatur-och-vind/brandrisk
- SMHI fire-risk forecast explanation: https://www.smhi.se/kunskapsbanken/meteorologi/vaderprognoser/brandriskprognoser
- SMHI map/class descriptions: https://www.smhi.se/kunskapsbanken/meteorologi/vaderprognoser/om-brandriskprognoskartor
