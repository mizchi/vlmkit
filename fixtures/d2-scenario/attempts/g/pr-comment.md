Checkout, one request, end to end. `ret` = a return, `async` = fire-and-forget
(`orders` does not wait for `broker`, so messages 6 and 7 do not depend on it).

```
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
     |<-ret-order-id--|                |              |               |    
     |                |                |              |               |    
```

Source: `checkout-calls.d2` (`d2 --layout=tala --ascii-mode standard checkout-calls.d2 checkout-calls.ascii.txt`).
