package com.agri.trace;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

public final class Common {
  private Common() {}

  public static String today() {
    return LocalDate.now().toString();
  }

  public static Map<String, Object> ok(Object data) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("code", 0);
    m.put("data", data);
    return m;
  }

  public static Map<String, Object> map(Object... kv) {
    Map<String, Object> m = new LinkedHashMap<>();
    for (int i = 0; i + 1 < kv.length; i += 2) m.put(String.valueOf(kv[i]), kv[i + 1]);
    return m;
  }

  public static int num(Object o) {
    if (o == null) return 0;
    if (o instanceof Number n) return n.intValue();
    try {
      return (int) Math.round(Double.parseDouble(String.valueOf(o)));
    } catch (Exception e) {
      return 0;
    }
  }

  public static String str(Object o) {
    return o == null ? null : String.valueOf(o);
  }

  public static String traceCodeOf(long batchId) {
    return "AG34012201" + today().substring(2).replace("-", "") + String.format("%04d", batchId) + "A";
  }

  /** 与前端 Mock 同一套 FNV 摘要，保证哈希链一致 */
  public static String hexHash(String seed, int len) {
    int h = 0x811c9dc5;
    StringBuilder out = new StringBuilder(len);
    for (int i = 0; i < len; i++) {
      h ^= (seed.charAt(i % seed.length()) + i * 131);
      h *= 16777619;
      out.append(Integer.toHexString(h & 0xf));
      h = (h >>> 4) ^ (h << 3);
    }
    return out.toString();
  }
}
