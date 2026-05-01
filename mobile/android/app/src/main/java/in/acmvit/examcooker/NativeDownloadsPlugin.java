package in.acmvit.examcooker;

import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

@CapacitorPlugin(name = "NativeDownloads")
public class NativeDownloadsPlugin extends Plugin {
    @PluginMethod
    public void shareFile(PluginCall call) {
        String fileName = call.getString("fileName");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        String base64Data = call.getString("base64Data");

        if (fileName == null || fileName.trim().isEmpty()) {
            call.reject("fileName is required");
            return;
        }

        if (base64Data == null || base64Data.isEmpty()) {
            call.reject("base64Data is required");
            return;
        }

        try {
            byte[] data = Base64.decode(base64Data, Base64.DEFAULT);
            File file = writeCacheFile(data, fileName);
            Uri uri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                file
            );

            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType(mimeType);
            intent.putExtra(Intent.EXTRA_STREAM, uri);
            intent.setClipData(ClipData.newRawUri(file.getName(), uri));
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            Intent chooser = Intent.createChooser(intent, "Save or share file");
            getActivity().startActivity(chooser);

            JSObject result = new JSObject();
            result.put("fileName", file.getName());
            call.resolve(result);
        } catch (IllegalArgumentException error) {
            call.reject("base64Data is invalid", error);
        } catch (Exception error) {
            call.reject("Failed to prepare file", error);
        }
    }

    private File writeCacheFile(byte[] data, String fileName) throws IOException {
        String safeFileName = fileName
            .replace("/", "-")
            .replace("\\", "-")
            .replace(":", "-")
            .trim();

        if (safeFileName.isEmpty()) {
            safeFileName = "ExamCooker.pdf";
        }

        File directory = new File(getContext().getCacheDir(), "ExamCookerDownloads");
        if (!directory.exists() && !directory.mkdirs()) {
            throw new IOException("Unable to create downloads cache");
        }

        File file = new File(directory, safeFileName);
        try (FileOutputStream output = new FileOutputStream(file, false)) {
            output.write(data);
        }
        return file;
    }
}
