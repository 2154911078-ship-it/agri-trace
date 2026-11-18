package com.agri.trace;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InterfaceAddress;
import java.net.NetworkInterface;
import java.util.Collections;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/system")
public class NetworkController {
  @GetMapping("/lan")
  public Map<String, Object> lan() {
    try {
      for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
        if (!ni.isUp() || ni.isLoopback() || ni.isVirtual()) continue;
        for (InterfaceAddress ia : ni.getInterfaceAddresses()) {
          InetAddress a = ia.getAddress();
          if (a instanceof Inet4Address && !a.isLoopbackAddress() && !a.isLinkLocalAddress()) {
            return Common.ok(Common.map("ip", a.getHostAddress(), "interface", ni.getName()));
          }
        }
      }
    } catch (Exception ignored) {
    }
    return Common.ok(Common.map("ip", "127.0.0.1", "interface", "loopback"));
  }
}
