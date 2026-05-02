package in.acmvit.examcooker;

import android.os.Bundle;
import android.view.View;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeDownloadsPlugin.class);
        super.onCreate(savedInstanceState);
        getBridge().getWebView().setOverScrollMode(View.OVER_SCROLL_NEVER);
    }
}
