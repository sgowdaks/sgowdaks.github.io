---
title: "From Bare Metal to Containers: A Deep Dive into Virtualization and Docker Internals"
subtitle: "How chroot, namespaces, cgroups, and union filesystems combine to make containers work — and where the cloud fits in"
category: "Technology"
date: "April 21, 2026"
tags: Docker, Containers, Virtualization, Linux, Kubernetes, Cloud, Azure, VMware, Systems Programming
disclaimer: true
---

## Why I Wrote This

I spent a solid chunk of time recently going back to fundamentals on containerization and cloud infrastructure — not the "run `docker run hello-world`" tutorial kind, but the *why does this actually work* kind. These are my consolidated notes. If you've ever wondered what Docker is actually doing under the hood, or why a container starts in milliseconds while a VM takes minutes, this should be useful.

---

## 1. The Core Philosophy: Virtualization

**Virtualization** is the act of creating a software-based version of something physical — usually hardware.

The goal is **efficiency**. A modern server has 64 cores and hundreds of gigabytes of RAM. Running a single application on it is like buying a 20-bedroom house for one person. Virtualization lets us carve that hardware into smaller, isolated "slices" so multiple workloads can share the same machine without stepping on each other.

---

## 2. The Evolution of Isolation

We didn't jump straight from "one app per server" to Docker. The path went through several increasingly sophisticated tools:

| Tool | Level of Isolation | Key Mechanism | Weakness |
| :--- | :--- | :--- | :--- |
| **chroot** | Filesystem only | Changes the root `/` pointer to a subdirectory | Process can still see all RAM, CPU, and other PIDs. Root users can escape. |
| **Docker** | Complete process | Namespaces + Cgroups + UnionFS | Shared kernel — a kernel bug affects the whole host. |
| **VMs** | Hardware-level | Hypervisor simulates a full computer | Heavy, slow to boot, high RAM/disk overhead. |

Each step in this evolution added a new dimension of isolation.

---

## 3. The Three Pillars of Docker

Docker isn't a single technology — it's a clean wrapper around three Linux kernel features that already existed. Understanding these is the key to understanding *why* Docker works the way it does.

### A. Namespaces — The "Blindfold"

Namespaces control what a process can **see**.

When Docker starts a container, it creates several namespaces for that process:

- **PID namespace:** The container's first process thinks it is PID 1. It can't see any processes outside its namespace.
- **NET namespace:** The container gets its own private network stack — its own IP address, its own routing table, its own ports.
- **MNT namespace:** The container sees a private view of the filesystem — not the host's.
- **UTS namespace:** The container can have its own hostname, separate from the host.

The container isn't running in a "virtual machine" — it's a normal Linux process that has been given blinders. It genuinely cannot see what's outside.

### B. Cgroups — The "Strict Budget"

Cgroups (control groups) control what a process can **use**.

They let you set hard limits on:
- **RAM** — Container A gets at most 2GB. Even if the host has 64GB free, it cannot take more.
- **CPU** — Container B gets at most 2 cores worth of time.
- **Disk I/O** — Throttle read/write bandwidth per container.

Without cgroups, a runaway container could consume all the host's memory and crash everything. Cgroups are the mechanism that makes containers safe to run side-by-side.

### C. Union File System — The "Shared Library"

This is the most architecturally interesting piece. It controls how files are **stored and shared**.

The naive approach would be: for every container, copy the entire OS filesystem. A 500MB Ubuntu image × 100 containers = 50GB of wasted disk space. UnionFS solves this with **layering** and **copy-on-write**.

---

## 4. How Union File System Actually Works

### The Technical Reality (No Tracing Paper Needed)

There are no physical "layers" stacked inside your hard drive. Your hard drive is a flat surface of bits.

"Layering" is a **software trick** performed by the Linux kernel using something called a **Union Mount**. Think of it as a **priority search order** over a list of read-only directories.

Imagine three folders on disk:

```
Folder_A   ← bottom layer (e.g., Ubuntu base image)
Folder_B   ← middle layer (e.g., Python 3.4 runtime)
Folder_C   ← top layer   (writable, container-specific changes)
```

When a process inside the container asks for `index.html`, the union filesystem:

1. Looks in `Folder_C` — not there.
2. Looks in `Folder_B` — not there.
3. Looks in `Folder_A` — found! Returns it.

If the same filename exists in multiple layers, the **higher layer wins**. The lower one is "shadowed" — it still exists on disk, but the container cannot see it.

### Copy-on-Write: How "Editing" a Read-Only File Works

Suppose you're inside a container and you try to edit `config.txt`, which lives in the read-only `Folder_A`:

1. The kernel says: "You can't edit the original — it's protected."
2. It **copies** `config.txt` from `Folder_A` into `Folder_C` (your writable layer).
3. It lets you edit the copy in `Folder_C`.
4. From now on, every lookup finds the `Folder_C` version first — the original in `Folder_A` is invisible.

To you, it looks like you edited a file. In reality, you created a new version in a higher-priority folder. This is **Copy-on-Write (CoW)**.

### Branching: Two Containers, Two Python Versions, One Ubuntu Base

Say you have two containers: one needs Python 3.4, the other needs Python 3.1. Here's what Docker actually stores on disk:

```
Ubuntu base image (shared by both containers)
    ├── Python 3.4 layer  →  Container A's middleware
    └── Python 3.1 layer  →  Container B's middleware

Container A writable layer  (only Container A's changes)
Container B writable layer  (only Container B's changes)
```

The Ubuntu files exist **exactly once** on disk. Both containers point to the same directory for Layer 1. When Container A looks up `python`, its priority search hits the Python 3.4 layer before reaching Ubuntu. Container B hits its Python 3.1 layer. They never interfere.

If Ubuntu happened to include Python 2.7, it gets silently shadowed by whichever Python is in Layer 2 — it still exists on disk, but neither container can see it.

**The mental model:**

> Docker treats your hard drive like a Lego set. You have the big "Ubuntu" block at the bottom. You can snap a "Python 3.1" block on top of one tower and a "Python 3.4" block on top of another. They share the base block, but they look different from the outside.

### Why This Matters Practically

- **Storage:** Ubuntu downloaded once, shared across hundreds of containers.
- **Speed:** Spinning up a container doesn't copy files — it just creates a new empty writable layer and sets up a search order. That's why containers start in milliseconds.
- **Consistency:** The read-only layers are content-addressed by SHA-256 hashes. The same image is byte-for-byte identical everywhere.

---

## 5. Containers vs. VMs: The Weight Difference

| | Virtual Machine | Docker Container |
| :--- | :--- | :--- |
| **OS Kernel** | Each VM has its own kernel | All containers share the host kernel |
| **Boot time** | Minutes | Milliseconds |
| **Disk footprint** | GBs | MBs |
| **Isolation** | Hardware-level (strong) | Process-level (good but shared kernel) |
| **Use case** | Run different OSes side by side, strong security boundaries | Many instances of the same app, same OS |

The key tradeoff: VMs are heavier but provide stronger isolation because each one has its own kernel. If the host kernel has a bug, a container is vulnerable; a VM is not. This is why production systems often run Docker **inside** a VM — you get both.

---

## 6. The Cloud Layer: VMware vs. Azure

Once you understand VMs and containers, the cloud makes much more sense.

### VMware — The Private Cloud Tool

VMware lets you take your own physical servers and "slice" them into virtual machines using a **hypervisor**. You own and manage everything — the hardware, the hypervisor software, the VMs on top.

### Azure — Public Cloud

Microsoft owns the data centers. You rent their "slices" — VMs, databases, networking — over the internet. You don't touch hardware; you just consume resources.

**2026 context:** VMware (now owned by Broadcom) moved to subscription-only pricing. Many enterprises responded by migrating their VMware workloads into **Azure VMware Solution (AVS)**, which runs VMware on Azure's hardware — eliminating the cost of managing the underlying servers.

---

## 7. Type 1 vs. Type 2 Hypervisors

The **hypervisor** is the software that makes virtualization possible. It sits between the hardware and the VMs, arbitrating who gets what resources.

### Type 1 — Bare Metal

Installed **directly on the physical hardware**, with no host OS in between.

Examples: **VMware ESXi**, **Microsoft Hyper-V**, **Xen**

- The hypervisor *is* the OS.
- Typically "headless" — no monitor, no desktop GUI. You manage it remotely via a web dashboard or SSH.
- All CPU/RAM goes to running workloads, not to drawing a UI.
- Used in enterprise data centers and cloud providers.

### Type 2 — Hosted

Runs on top of an existing OS (Windows, macOS, Linux).

Examples: **VirtualBox**, **VMware Workstation**

- The host OS (Windows, macOS) loads first, then you launch VMs as apps.
- Easier to use, but slower — every disk or network operation pays a "performance tax" to the host OS.
- Used for local development and testing.

Azure runs **Type 1 Hyper-V** under the hood (heavily customized). They also offload networking and storage chores to specialized chips called **Azure Boost DPUs**, so the main CPU only runs tenant workloads. The most recent generation uses **Azure Cobalt 100** — custom ARM-based processors Microsoft designed in-house.

---

## 8. The Grand Architecture

If you were building a production system today, the stack would likely look like this:

```
Level 0 │ Physical server (bare metal)
        │
Level 1 │ Type 1 Hypervisor (VMware ESXi or Hyper-V)
        │  → carves hardware into isolated VMs
        │
Level 2 │ Virtual Machine
        │  → its own kernel, own network, own disk
        │
Level 3 │ Docker (inside the VM)
        │  → lightweight containers sharing the VM's kernel
        │
Level 4 │ App in an Alpine Linux container
        │  → tiny userland (~5MB), just enough to run your code
```

This layering gives you:
- **Security** from the hypervisor (VM isolation with separate kernels)
- **Speed** from Docker (millisecond startup, minimal overhead)
- **Efficiency** from the whole stack (many apps on one server, sharing base images)

---

## Key Takeaways

- A Docker container is a normal Linux process that has been **blindfolded** (namespaces), put on a **budget** (cgroups), and given a **curated view of the filesystem** (UnionFS).
- "Layers" in Docker images are a software illusion — they are just directories searched in priority order.
- Copy-on-Write means you never actually modify a base image; you create a private version in your writable layer.
- VMs provide stronger isolation than containers because each VM has an independent kernel.
- Production systems often stack both: Docker inside a VM, getting the security of VMs and the speed of containers.
- Cloud providers like Azure are Type 1 hypervisor operators at massive scale, with custom hardware optimizations on top.
