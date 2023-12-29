new Vue({
    el: '#app',
    delimiters: ['${', '}'],
    data: {
        inventory: [],
        password: localStorage.getItem('password') || ''
    },
    mounted() {
        if (this.password) {
            this.loadInventory();
        } else {
            this.promptPassword();
        }
    },
    async created() {
        await this.loadInventory();
        const rowControlElements = document.querySelectorAll('.row-control');
        rowControlElements.forEach(element => {
            element.addEventListener('click', this.handleRowControlClick);
        });
    },
    methods: {
        promptPassword() {
            const password = localStorage.getItem('password');
            if (password) {
                this.password = password;
                this.loadInventory();
            } else {
                mscPrompt('Enter password', (enteredPassword) => {
                    this.password = enteredPassword;
                    localStorage.setItem('password', enteredPassword);
                    this.loadInventory();
                });
            }
        },
        async loadInventory() {
            try {
                const response = await axios.get(`https://docs.google.com/spreadsheets/d/e/2PACX-1vQIcKPeDcvTKS_7zH7-XekKAuO3cl7juVJOy3upThDIM2nnca7WKrXpYIC8oBebXDMM35hstr${this.password}/pub?gid=0&single=true&output=csv`);
                const data = response.data;
                const parsedData = Papa.parse(response.data, { header: true }).data;
                const json = { ...parsedData }
                this.inventory = json;
            } catch (error) {
                mscAlert('Incorrect');
                localStorage.removeItem('password');
                this.promptPassword();
            }
        },
        handleRowControlClick(event) {
            console.log("clicked");
            const tr = event.currentTarget.closest('tr');
            tr.classList.toggle('open');
        }
    }
});