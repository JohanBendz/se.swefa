# SMHI Sea Level and Waves

This feature adds two separate station-based Homey devices using SMHI Oceanographic Observations (OCobs):

- **SMHI Sea Level**
- **SMHI Waves**

They intentionally remain separate from the coordinate-based weather forecast device. These devices represent measurements from a named physical station or buoy, not an interpolated forecast for the Homey location.

## Pairing model

Pairing lists active stations from the relevant SMHI ocean parameter. When Homey's geolocation is available, the list is sorted by great-circle distance, but Homey never silently chooses a station for the user.

The selected SMHI station ID is the stable Homey device identity. Station name, owner, coordinates and supported optional parameters are stored as device metadata rather than being part of the identity.

## Sea Level

The Sea Level device uses SMHI's minute sea-level observations in RH2000.

SMHI's ocean catalog currently distinguishes:

- **Havsvattenstånd, minutvärde** — parameter 13, RH2000 presentation
- **Havsvattenstånd, RW minutvärde** — parameter 14, relative to calculated mean sea level

The resolver discovers parameters from the live catalog by semantic title and validates the known fallback. It explicitly excludes titles containing `RW` for this device.

Capabilities:

- Sea level RH2000 (cm)
- Station
- Observation time
- Observation age (minutes)
- SMHI quality code
- Source

The device polls every five minutes. The primary observation must be no more than 30 minutes old. Missing or stale primary data makes the device unavailable rather than presenting an old value as current.

Flow cards:

- Sea level rises above a selected RH2000 threshold
- Sea level falls below a selected RH2000 threshold
- Sea level is above a selected threshold
- Sea level is below a selected threshold

The trigger cards use actual threshold crossing semantics and do not fire repeatedly while the level remains on the same side of the threshold.

## Waves

The Waves device is paired from stations that provide **significant wave height**. The same station ID is used to determine whether optional measurements are also available.

Primary measurement:

- Significant wave height — SMHI parameter 1

Optional measurements from the same station:

- Maximum wave height — parameter 11
- Mean wave period — parameter 10
- Mean wave direction — parameter 7

Capabilities:

- Significant wave height (m)
- Maximum wave height (m), when supported
- Mean wave period (s), when supported
- Mean wave direction (degrees), when supported
- Mean wave direction as compass heading
- Station
- Observation time
- Observation age
- Quality
- Source

Wave observations are treated as station measurements. Direction is the direction **from which** the waves come, matching SMHI's convention.

The primary significant-wave-height observation must be no more than three hours old. Optional measurements may be absent or temporarily unavailable without making the whole Waves device unavailable.

Flow cards:

- Significant wave height rises above a selected threshold
- Maximum wave height rises above a selected threshold
- Significant wave height is above a selected threshold
- Maximum wave height is above a selected threshold

## Data quality

SMHI ocean observations use quality codes:

- **G** — controlled and approved
- **Y** — coarsely checked, suspected or aggregated
- **O** — unchecked

The code is surfaced on the device rather than hidden.

## Data source

SMHI Oceanographic Observations API:

`https://opendata-download-ocobs.smhi.se/api/version/1.0`

Relevant SMHI documentation:

- https://www.smhi.se/data/hav-och-havsmiljo/havsvattenstand
- https://www.smhi.se/kunskapsbanken/oceanografi/matningar-i-havet/havsobservationer
- https://www.smhi.se/kunskapsbanken/oceanografi/vattenstand-i-havet/hojdsystem-och-vattenstand
