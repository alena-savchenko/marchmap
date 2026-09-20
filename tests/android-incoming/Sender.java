package com.marchmap.intentfixture;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

public class Sender extends Activity {
  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    String scenario = getIntent().getStringExtra("scenario");
    if (scenario == null) scenario = "normal";
    Uri uri = Uri.parse("content://com.marchmap.intentfixture/" + scenario);
    Intent open = new Intent(scenario.equals("send") ? Intent.ACTION_SEND : Intent.ACTION_VIEW);
    open.setClassName("com.marchmap.standalone", "com.marchmap.standalone.MainActivity");
    open.setType("application/gpx+xml");
    open.setClipData(ClipData.newRawUri("GPX", uri));
    if (scenario.equals("send")) open.putExtra(Intent.EXTRA_STREAM, uri);
    else if (scenario.equals("mixed")) open.setDataAndType(Uri.parse("https://onedrive.live.com/?fixture=preview"), "application/gpx+xml");
    else if (!scenario.equals("clip")) open.setDataAndType(uri, "application/gpx+xml");
    open.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
    startActivity(open);
    finish();
  }
}
