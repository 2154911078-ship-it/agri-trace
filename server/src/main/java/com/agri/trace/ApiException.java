package com.agri.trace;

public class ApiException extends RuntimeException {
  public final int code;

  public ApiException(String msg, int code) {
    super(msg);
    this.code = code;
  }

  public ApiException(String msg) {
    this(msg, 400);
  }
}
