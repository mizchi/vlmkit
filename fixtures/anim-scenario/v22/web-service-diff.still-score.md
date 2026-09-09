# A web service, by module — what changed — the figure read back vs its facts

reader: web-service-diff.reading-sonnet.json

| fact | read | missed | invented | note |
|---|---|---|---|---|
| modules | 7 | — | — |  |
| deps | 6 | api->db, api->logging | logging->auth |  |
| group members | 7 | — | — |  |
| nesting | 0 | — | — |  |
| highlighted | 4 | api->search, search->db | — |  |

28 facts · read 24 · missed 4 · invented 1 · fidelity 0.83

layout defects — geometry: none · reader: crossed: the api->auth service, logs->auth service, auth service->db and search->db arrows all cross through the dense middle of the figure near the grey 'emits' label, making it hard to tell which arrow the label belongs to and to trace logs->auth service unambiguously

notes: The api->cache arrow is grey and dashed (unlike the solid black/orange arrows elsewhere), matching the legend's 'dashed grey: removed' key, and carries the label 'emits'; I still list it in deps per the instructions but its direction/attachment is the least certain reading in the figure. 'identity' is listed under highlighted because its container outline is orange (an accent colour), not the plain grey outline used by 'edge', 'core' and 'infrastructure'. One-sentence takeaway: the figure reads as though the service added a 'search' module and gained a new 'identity' grouping around a moved/highlighted 'auth service' and 'logs', while removing the old 'cache' module and the 'api--emits-->cache' link that fed it.
