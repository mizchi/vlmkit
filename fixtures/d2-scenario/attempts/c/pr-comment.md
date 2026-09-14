**What happens on a checkout** — `ret` = return, `async` = fire-and-forget (`orders` does not wait for `broker`):

```text
+--------+       +----------+     +---------+    +----------+   +---------+
|browser |       | gateway  |     | orders  |    |inventory |   | broker  |
|        |       |          |     |         |    |          |   |         |
+--------+       +----------+     +---------+    +----------+   +---------+
     |                |                |              |               |    
     |-POST /checkout>|                |              |               |    
     |                |                |              |               |    
     |                |---createOrder->|              |               |    
     |                |                |              |               |    
     |                |                |----reserve-->|               |    
     |                |                |              |               |    
     |                |                |<ret-reserved-|               |    
     |                |                |              |               |    
     |                |                |------order.placed-async----->|    
     |                |                |              |               |    
     |                |<ret-201 Created|              |               |    
     |                |                |              |               |    
     |<-ret-order id--|                |              |               |    
     |                |                |              |               |    
```
