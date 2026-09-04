# Brief: the cache-aside pattern

Produce `scene.json` (kind `diagram`) explaining **cache-aside**: an app
reads from a cache; on a miss it reads the database and writes the result into
the cache; the next read hits.

Nodes: App, Cache, Database. Show a miss then a hit, with captions. The
database should only become visible when it is first needed.

Success: `vlmkit-anim check scene.json` exits 0 with no ✗ and no ⚠.
