package com.marchmap.intentfixture;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

public class Provider extends ContentProvider {
  @Override public boolean onCreate() { return true; }
  @Override public String getType(Uri uri) { return "application/octet-stream"; }
  @Override public Cursor query(Uri uri, String[] projection, String selection, String[] args, String sort) {
    String scenario = uri.getLastPathSegment();
    if ("queryerror".equals(scenario)) throw new UnsupportedOperationException("No metadata");
    MatrixCursor cursor = new MatrixCursor(new String[] { OpenableColumns.DISPLAY_NAME });
    cursor.addRow(new Object[] { "opaque".equals(scenario) ? "cloud-object-123" : "Test-" + scenario + ".gpx" });
    return cursor;
  }
  @Override public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
    String scenario = uri.getLastPathSegment();
    String xml = "invalid".equals(scenario) ? "<html>Login required</html>" :
      "<gpx><trk><name>Incoming-" + scenario + "</name><trkseg><trkpt lat=\"52.5\" lon=\"13.4\"><ele>40</ele></trkpt><trkpt lat=\"52.51\" lon=\"13.41\"><ele>50</ele></trkpt></trkseg></trk></gpx>";
    File file = new File(getContext().getCacheDir(), "fixture.gpx");
    try (FileOutputStream out = new FileOutputStream(file)) { out.write(xml.getBytes(StandardCharsets.UTF_8)); }
    catch (Exception e) { throw new FileNotFoundException(e.toString()); }
    return ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY);
  }
  @Override public Uri insert(Uri uri, ContentValues values) { throw new UnsupportedOperationException(); }
  @Override public int update(Uri uri, ContentValues values, String where, String[] args) { throw new UnsupportedOperationException(); }
  @Override public int delete(Uri uri, String where, String[] args) { throw new UnsupportedOperationException(); }
}
