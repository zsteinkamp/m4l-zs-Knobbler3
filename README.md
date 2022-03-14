# m4l-zs-Knobbler3
## An auto-labeling control surface for Ableton Live and TouchOSC.

This is a Max For Live device and a TouchOSC layout that provides a control surface that auto-labels parameter controls when a parameter is mapped, and minimizes the steps required to map controls.

The problem with in-the-box musicmaking is that the best control surfaces like the Push 2 are modal, requiring you to navigate menus to find parameters, and non-modal surfaces like the BCR-2000 require you to either remember knob assignments or write them on the device itself. This poses a barrier to switching between projects, or simply remembering knob assignments from day-to-day.

With the zs-Knobbler3, you get 32 auto-labeling fader controls, 10 MIDI faders, and 8 MIDI buttons. When you map one of the auto-labeling faders using this device, the TouchOSC layout instantly displays the parameter name, device name, and track name of the mapped parameter.

The mappings are saved with your Live Set, so you can switch between sets and your mappings (and labels!) are preserved.

## Usage

### Mapping a Parameter

Click a parameter in Ableton Live. It should be highlighted either with a rectangle (e.g. for small text boxes like Send Values) or its corners will be highlighted (e.g. knobs). Then touch the slider you want to map it to and slide up slightly, then remove your finger. You should see the parameter / device / track name show up, and the slider will jump to its current value.

### Unmapping a Slider

Click the red "X" in the upper-left corner of the TouchOSC interface. All of the sliders will change to solid red boxes. Tap the box or boxes that you want to unmap. Click the red button in the upper left corner to exit unmapping mode.

If you would prefer to unmap in the computer, you can click the "x" next to the parameter in the zs-Knobbler3 device itself.

## Installation / Setup

If you just want to download and install the device, then go to the [frozen/](https://github.com/zsteinkamp/m4l-zs-Knobbler3/tree/main/frozen) directory and download the newest version there.

### Changelog

* [1.1.0](https://github.com/zsteinkamp/m4l-zs-Knobbler3/raw/main/frozen/zs-Knobbler3-1.1.0.amxd) - 2022-03-13 - Go all-in on OSC, no more MIDI. Much simpler, faster, and better.
* [1.0.1](https://github.com/zsteinkamp/m4l-zs-Knobbler3/raw/main/frozen/zs-Knobbler3-1.0.1.amxd) - 2022-03-09 - More confidence in fixing path saving problem.
* [1.0.0](https://github.com/zsteinkamp/m4l-zs-Knobbler3/raw/main/frozen/zs-Knobbler3-1.0.0.amxd) - 2022-03-09 - First solid, frozen release. Added zeroconf, fixed bug with inserting tracks or devices (updating parameter path when necessary).

### TouchOSC (iPad) to Computer Connection

You will need to configure TouchOSC to send OSC to your computer. zs-Knobbler3 advertises itself on your network, so you should be able to open TouchOSC's Connections config (the chain icon), Tap OSC, then in Connection 1, tap Browse. You should see zs Knobbler3 in the dropdown list. Tap it, and then tap the IPv4 address (e.g. 192.168.x.x:2346) in the flyout menu.

NOTE: Max/MSP and Max For Live are limited to only working with IPv4 addresses. If you pick an IPv6 address (e.g. `[fe80:xxxx:xxxx:xxxx:xxxx%en0]:2346`) it will not work.

### Computer to TouchOSC (iPad) Connection

The zs-Knobbler3 uses OSC (not MIDI) to communicate parameter/device/track names and values to TouchOSC running on the iPad. It uses service auto-discovery (zeroconf) to know what OSC devices are on the network. The dropdown list should contain your iPad. If not, you can edit the Host and Port boxes manually.

## Common Problems

#### I get a "Spinning Beach Ball" when I try to use zs-Knobbler3.
This usually means that the Host value is incorrect. Max will do this if it is waiting for a DNS lookup to finish. Either fix the name, or use the IP address of the iPad.
