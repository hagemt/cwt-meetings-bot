# Cisco Webex Teams bot to schedule meeting rooms

Hackathon code for Develop@Cisco 2018 (MVP: Cisco Spark bot to help schedule meetings)

When I ask it "book XYZ tomorrow at 4pm" look at the calendar and add XYZ as where to meet.

If there's not a meeting, IDK maybe it should create one with just one person invited. (you)

TBD: other commands, or a more logical interface, without scope creeping too far into NLP.

## Philosophy and tools

Use `cisco-webex-tools` (w/ new webhooks features) and pattern of using an EventEmitter acting as a bus.

Validation code packaged originally as `ciscospark-webhook-validator` module. Integrates with GSuite.
