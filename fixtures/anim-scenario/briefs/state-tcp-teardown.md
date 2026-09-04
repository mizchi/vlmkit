# Brief: TCP connection teardown as a state machine

Produce `scene.json`: a state machine of the **active close** side of TCP
teardown. States: ESTABLISHED → FIN_WAIT_1 → FIN_WAIT_2 → TIME_WAIT → CLOSED,
plus the simultaneous-close path FIN_WAIT_1 → CLOSING → TIME_WAIT.

Events (use these names): `close` (app closes; send FIN), `ACK` (peer acks our
FIN), `FIN` (peer's FIN arrives; send ACK), `timeout` (2MSL timer).

Requirements:
- Transitions carry a `note` saying what is sent (e.g. "/ send FIN").
- Show the normal path first as the trace: close, ACK, FIN, timeout.
- CLOSED is a final state.

Success: `vlmkit anim check scene.json` exits 0 and the trace fires all four events.
