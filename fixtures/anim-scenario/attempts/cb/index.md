# HTTP/2 Multiplexing: Why It's Faster

Two scenes comparing HTTP/1.1 and HTTP/2 asset delivery.

1. **scene-1.json**: HTTP/1.1 with two connections and head-of-line blocking
   - Shows how FIFO queues on each connection serialize assets
   - Total time: 5 units

2. **scene-2.json**: HTTP/2 with one connection and 6 concurrent streams
   - Shows how multiplexing allows all assets to progress together
   - Total time: 3 units (40% faster)
   - Key win: small assets (c, d, f) finish immediately instead of waiting in a queue
