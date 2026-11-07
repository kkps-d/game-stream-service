# Terminology

Short definitions for the [project overview](README.md). Mentioning a technology here does not mean it has been selected.

## Host and isolation

| Term | Meaning |
| --- | --- |
| Host / bare metal | The physical computer running the service; bare metal means Linux runs directly on it, without a virtual machine underneath. |
| Virtual machine (VM) | A software-defined computer that runs its own operating system kernel. |
| Container | An isolated group of processes that shares the host's operating system kernel. |
| Podman | A tool for building and running containers. |
| Container image | A packaged filesystem containing an application and the dependencies needed to run it. |
| Linux namespaces | A Linux feature that gives processes separate views of resources, such as processes, networks, and filesystems. |
| cgroups | Linux controls for grouping processes and measuring or limiting resource use, such as CPU and memory. |
| Kernel / userspace | The kernel manages hardware and system resources; userspace is where applications and most supporting libraries run. |
| Driver | Software that lets the operating system or applications work with hardware. |
| Session / runtime | A session is one user's running environment; its runtime is the software needed to operate it. |
| Orchestration | Coordinating session creation, monitoring, resource allocation, and shutdown. |
| Persistent data | Data retained after a session or container stops or is replaced. |

## Graphics and game compatibility

| Term | Meaning |
| --- | --- |
| GPU / VRAM | The graphics processor and its memory, used for rendering and other graphics work. |
| Rendering / hardware acceleration | Rendering creates images; hardware acceleration uses specialized hardware, such as a GPU, to perform work. |
| Headless | Running without a physical display attached to the session. |
| Wayland / compositor | Wayland is a protocol for communication between applications and a display server; a compositor manages windows, display output, and input routing. |
| X11 / XWayland | X11 is an older Linux windowing protocol; XWayland lets X11 applications run under a Wayland compositor. |
| Gamescope / Weston | Wayland compositors under consideration: Gamescope focuses on games; Weston is a reference implementation of a Wayland compositor. |
| Native Linux application | An application built to run on Linux directly. |
| Wine / Proton | Wine provides compatibility for Windows applications on Linux; Proton builds on Wine and other tools for Windows games. |
| Vulkan | An interface applications use to request graphics and compute work from a GPU. |
| Direct3D / DXVK / VKD3D | Direct3D is a Windows graphics interface. DXVK translates Direct3D 9–11 to Vulkan; VKD3D translates Direct3D 12 to Vulkan. |
| Anti-cheat | Software or service checks intended to detect or prevent cheating in games. |

## Input and streaming

| Term | Meaning |
| --- | --- |
| Input focus / injection | Focus determines which application receives input; injection delivers software-generated input events to a session or application. |
| Capture | Collecting a session's video frames and audio for streaming. |
| Encoder / hardware encoding | An encoder compresses video or audio for transmission; hardware encoding uses dedicated hardware to do that work. |
| WebRTC | Technologies for real-time audio, video, and data communication, including support in web browsers. |
| Latency | Delay, such as the time between pressing a button and seeing the result. |
| Client | The device or application a user connects from to view a stream and send input. |

## Planning

| Term | Meaning |
| --- | --- |
| Prototype / proof of concept | A small experiment used to check whether an approach works before committing to a fuller implementation. |
| Scaffolding / integration | Scaffolding creates a project's initial structure; integration connects its components so they work together. |
