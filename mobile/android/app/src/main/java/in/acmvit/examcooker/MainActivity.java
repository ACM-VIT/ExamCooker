package in.acmvit.examcooker;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeDownloadsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
