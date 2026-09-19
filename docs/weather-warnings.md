# SMHI Weather Warnings driver

This branch adds a separate Homey device for SMHI's official impact-based weather warnings.

## Data source

The driver uses the documented SMHI warning feed:

`https://opendata-download-warnings.smhi.se/ibww/api/version/1/warning.json`

SMHI supplies warning areas as GeoJSON. The Homey device matches its configured longitude/latitude against the actual warning polygon rather than relying on county names.

## Scope

The driver intentionally includes only official warning levels:

- Yellow
- Orange
- Red

SMHI `MESSAGE` entries are excluded. Those include information such as water-shortage and other messages that may be better represented by separate purpose-specific devices.

Both currently active and already-issued upcoming warnings are retained. The status capability tells whether the highest-priority displayed warning is active or upcoming. The Flow condition **warning active now** can be used when only the current validity window matters.

## Official text

SMHI warning content is not machine-translated or rewritten. Swedish Homey users receive SMHI's Swedish text when supplied by the API. Other languages use SMHI's English text, with Swedish only as a fallback when the API has no English field.

The device exposes **SMHI** as the source.

## Update behaviour

Each warning device checks every 30 minutes. The nationwide warning payload is cached at app level for ten minutes and concurrent requests share the same fetch promise, so multiple warning devices on one Homey do not produce duplicate simultaneous SMHI downloads.

The first fetch after adding or restarting a device establishes a baseline and does not emit false "issued" triggers. Changing device coordinates also resets the baseline.

## Flow cards

Triggers:

- SMHI weather warning issued
- SMHI weather warning updated
- SMHI weather warning ended

Conditions:

- an issued warning exists for this location
- a warning is active now
- highest warning level is at least Yellow / Orange / Red

Trigger tokens include warning ID, level, event, area, validity timestamps and source.

## Licensing / use

SMHI states that impact-based warning information may be reused, including commercially, provided that the information is not altered and SMHI is always identified as the source. The implementation is designed around those requirements.
